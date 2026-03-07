import Permission from "./permission-model.js";

export const addPermission = async (req, res) => {
    try {
        const isExist = await checkDuplicatePermission(req.body)
        if (isExist) {
            return res.status(404).json({ message: 'Permission name already exist' });
        }

        const add = await Permission.create(req.body)
        return res.status(200).json({ data: add, message: 'Permission Added Successfully' })
    } catch (error) {
        return res.status(500).json({ message: 'Server error' });
    }
}

export const getPermission = async (req, res) => {
    try {
        const add = await Permission.find()
        return res.status(200).json({ data: add, message: 'Permission fetch Successfully' })
    } catch (error) {
        console.error(error.message);
        return res.status(500).json({ message: 'Server error' });
    }
}

export const updatePermission = async (req, res) => {
    try {
        const _id = req.params.id;

        const data = await Permission.findOne({ _id });
        if (data) {
            const isExist = await checkDuplicatePermission(req.body, _id);
            if (isExist) {
                return res.status(400).json({ message: 'Permission name already exists' });
            }

            const update = await Permission.findByIdAndUpdate(_id, req.body, { new: true });
            return res.status(200).json({ data: update, message: 'Permission updated successfully' });
        } else {
            return res.status(404).json({ message: 'No Permission Found' });
        }
    } catch (error) {
        return res.status(500).json({ message: 'Server error' });
    }
}


export const deletePermission = async (req, res) => {
    try {
        const _id = req.params.id;
      
        const data = await Permission.findOne({ _id });
        if (data) {
            const deleteData = await Permission.findByIdAndDelete(_id)
            res.status(200).json({ data: deleteData, message: 'Permission deleted Successfully' })
        } else {
            return res.status(404).json({ message: 'No Permission Found' });
        }
    } catch (error) {
        return res.status(500).json({ message: 'Server error' });
    }
}


export const checkDuplicatePermission = async (body, id) => {
    const { permission_name } = body;
    let data;

    if (id) {
        data = await Permission.findOne({
            permission_name:{
                $regex: permission_name,
                $options: 'i'
            },
            _id: { $ne: id }
        });
    } else {
        data = await Permission.findOne({ 
            permission_name:{
                $regex: permission_name,
                $options: 'i'
            },
         });
    }

    return data;
}
