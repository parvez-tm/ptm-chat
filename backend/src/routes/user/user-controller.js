import User from "./user-model.js";
import bcrypt from 'bcryptjs';
import { sanitizeData } from "../../services/sanitize-service.js";

export const getAllUsers = async (req, res) => {
  try {
    const { query, sort, limit, page } = parseRequestParams(req);
    
    // console.log('Processed query parameters:', { query, sort, limit, page });

    const [users, totalDocs] = await Promise.all([
      fetchUsers(query, sort, limit, page),
      User.countDocuments(query)
    ]);

    // console.log(`Found ${totalDocs} total documents matching the query`);

    const paginationInfo = calculatePaginationInfo(totalDocs, limit, page);
    
    // console.log('Pagination info:', paginationInfo);

    return res.status(200).json({ data: users, pagination: paginationInfo });
  } catch (error) {
    console.error('Error in getAllUsers:', error);
    return res.status(500).json({ message: 'Server error', error: error });
  }
};

const parseRequestParams = (req) => {
  const defaultParams = { query: { isDeleted: false }, sort: {}, limit: 10, page: 1 };
  
  if (!req.query.data) return defaultParams;

  try {
    const data = JSON.parse(req.query.data);
    return {
      query: { ...parseSearchFilters(data.search), isDeleted: false },
      sort: data.sorting || {},
      limit: Math.max(1, parseInt(data.dataLimit, 10) || defaultParams.limit),
      page: Math.max(1, parseInt(data.pagination, 10) || defaultParams.page)
    };
  } catch (error) {
    console.warn('Error parsing request parameters:', error);
    return defaultParams;
  }
};

const parseSearchFilters = (search) => {
  if (!search) return {};
  return Object.entries(search).reduce((acc, [key, value]) => {
    if (value && value.trim() !== '') {
      acc[key] = { $regex: value.trim(), $options: 'i' };
    }
    return acc;
  }, {});
};

const fetchUsers = async (query, sort, limit, page) => {
  const skip = (page - 1) * limit;
  return User.find(query)
    .select('-password -refreshToken')
    .sort(Object.keys(sort).length > 0 ? sort : undefined)
    .skip(skip)
    .limit(limit)
    .lean()
    .exec();
};

const calculatePaginationInfo = (totalDocs, limit, page) => {
  const totalPages = Math.max(1, Math.ceil(totalDocs / limit));
  const currentPage = Math.min(page, totalPages);
  
  return {
    currentPage,
    totalPages,
    pageSize: limit,
    totalDocs,
  };
};


export const getUserById = async (req, res) => {
  try {
    const _id = req.params.id;
    const data = await User.findOne({ _id, isDeleted: false }).select('-password -refreshToken');
    if(data){
      return res.status(200).json({data : data, message: 'User found successfully'});
    }else{
      return res.status(404).json({message: 'No User Found'});
    }
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error });
  }
};

export const addUser = async (req, res) => {
    try {
      let body = JSON.parse(req.body.data)
      let data = sanitizeData(body)

      if(req.file){
        data.pic = req.file.filename
      }

      const { email, password, userName, firstName, lastName } = data;

      if ( !email || !password || !userName || !firstName || !lastName) {
        return res.status(400).json({ message: "Please enter all fields" });
      }
  
      const isExist = await checkDuplicateUser(data);

      if (isExist) {
        if(isExist.email == data.email){
          return res.status(400).json({ message: 'User email already exists' });
        }
        if(isExist.userName == data.userName){
          return res.status(400).json({ message: 'Username already exists' });
        }
      }
      
      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
  
      data.password = hashedPassword
  
      const add = await User.create(data);
  
      return res.status(201).json({ data:add , message: 'User registered successfully' });
    } catch (error) {
      return res.status(500).json({ message: 'Server error', error: error });
    }
  };

export const updateUser = async (req, res) => {
  try {
    const _id = req.params.id;
    let body = JSON.parse(req.body.data)
    let data = sanitizeData(body)
    if(req.file){
      data.pic = req.file.filename
    }

    if(data.password){
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(data.password, salt);
  
      data.password = hashedPassword
    }
    
    const user = await User.findOne({ _id });
    if (user) {
        const isExist = await checkDuplicateUser(data, _id);

        if (isExist) {
          if(isExist.email == data.email){
            return res.status(400).json({ message: 'User email already exists' });
          }
          if(isExist.userName == data.userName){
            return res.status(400).json({ message: 'Username already exists' });
          }
        }


        
        // findOneAndUpdate : requires filter like this - let filter = { _id: req.params.id } ( User.findOneAndUpdate(filter, req.body) )
        // findByIdAndUpdate : requires id - const _id = req.params.id ( require this { new: true } )
        
        const update =  await User.findByIdAndUpdate(_id, data,  { new: true })
        return res.status(200).json({ data: update, message: 'User updated successfully' });
    } else {
        return res.status(404).json({ message: 'No User Found' });
    }
   
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error });
  }
};

export const deleteUser = async (req, res) => {
  try {    
    const _id = req.params.id;
    const user = await User.findById(_id);

    if(!user || user.isDeleted){
      return res.status(404).json({message: 'No User Found'});
    }

    user.isDeleted = true;
    await user.save();

    return res.status(200).json({data : user, message: 'User deleted successfully'});
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error });
  }
};

export const checkDuplicateUser = async (body, id) => {
  const { userName, email } = body;

  let query;

  if (id) {
    query = {
      $or: [{ userName }, { email }],
      _id: { $ne: id }
    };
  } else {
    query = {
      $or: [{ userName }, { email }]
    };
  }

  const data = await User.findOne(query);

  return data;
};