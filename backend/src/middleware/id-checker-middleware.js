export const id_checker_middleware = (req, res, next) => {
    try {
        const _id = req.params.id;
        if (!_id) {
            return res.status(404).json({ message: 'Id is required' });
        }
        if (_id.length != 24) {
            return res.status(400).json({ message: 'Invalid Id' });
        }
        next();
    } catch (error) {
        return res.status(500).json({ message: 'Server error' });
    }
}