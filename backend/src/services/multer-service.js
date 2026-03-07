import multer from 'multer';
import fs from 'fs';
import path from 'path';


export const storage =(dirName)=> multer.diskStorage({
    destination: function (req, file, cb) {
      const directory = `./public/${dirName}`;
      fs.mkdir(directory, { recursive: true }, (err) => {
          if (err) {
              console.error('Error creating directory:', err);
          } else {
              cb(null, directory);
          }
      });
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
      cb(null, `${Date.now()}-${file.originalname}`)
    }
  })
  
export const profileImage = multer({ storage: storage('profileImage') })