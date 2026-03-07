export const admin_middleware = (req,res,next) => {
    try {
        if(req.user.roleId != 1){
            return res.status(403).json({ message: "You don't have permission to access the data" });
        }

        next();
    } catch (error) {
        return res.status(500).json({ message: 'Server error' });
    }
}