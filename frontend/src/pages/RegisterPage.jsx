import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './AuthPages.css';

const RegisterPage = () => {
    const [formData, setFormData] = useState({
        userName: '',
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { register } = useAuth();
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (formData.password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setLoading(true);

        try {
            const { confirmPassword, ...userData } = formData;
            await register(userData);
            navigate('/chat');
        } catch (err) {
            setError(err.response?.data?.message || 'Registration failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-card auth-card--register">
                <div className="auth-header">
                    <div className="auth-logo">
                        <svg viewBox="0 0 24 24" fill="none" className="logo-icon">
                            <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                    <h1>Create Account</h1>
                    <p>Join PTM Chat today</p>
                </div>

                {error && <div className="auth-error">{error}</div>}

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="firstName">First Name</label>
                            <input
                                id="firstName"
                                name="firstName"
                                type="text"
                                value={formData.firstName}
                                onChange={handleChange}
                                placeholder="John"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="lastName">Last Name</label>
                            <input
                                id="lastName"
                                name="lastName"
                                type="text"
                                value={formData.lastName}
                                onChange={handleChange}
                                placeholder="Doe"
                                required
                            />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="userName">Username</label>
                            <input
                                id="userName"
                                name="userName"
                                type="text"
                                value={formData.userName}
                                onChange={handleChange}
                                placeholder="johndoe"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="reg-email">Email Address</label>
                            <input
                                id="reg-email"
                                name="email"
                                type="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="john@example.com"
                                required
                                autoComplete="email"
                            />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="reg-password">Password</label>
                            <input
                                id="reg-password"
                                name="password"
                                type="password"
                                value={formData.password}
                                onChange={handleChange}
                                placeholder="Min 6 characters"
                                required
                                autoComplete="new-password"
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="confirmPassword">Confirm Password</label>
                            <input
                                id="confirmPassword"
                                name="confirmPassword"
                                type="password"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                placeholder="Re-enter password"
                                required
                                autoComplete="new-password"
                            />
                        </div>
                    </div>

                    <button type="submit" className="auth-btn" disabled={loading}>
                        {loading ? (
                            <span className="btn-loader"></span>
                        ) : (
                            'Create Account'
                        )}
                    </button>
                </form>

                <div className="auth-footer">
                    <p>Already have an account? <Link to="/login">Sign in</Link></p>
                </div>
            </div>
        </div>
    );
};

export default RegisterPage;
