import mongoose from 'mongoose';

const permissionSchema = new mongoose.Schema({
    permission_name: { type: String, required: true },
    is_default:{ type: Number , default : 0}    
  },
  { timestamps: true }
);
  
const Permission = mongoose.model('Permission', permissionSchema);

export default Permission