import mongoose from 'mongoose';

const userPermissionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, required: true , ref : 'User' },
    permissions: [{ permission_name: String, permission_value: [String]}]
    
  },
  { timestaps: true }
);
  
const UserPermission = mongoose.model('UserPermission', userPermissionSchema);

export default UserPermission