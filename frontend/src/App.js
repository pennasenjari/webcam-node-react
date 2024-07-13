import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Modal from './Modal';
import './App.css';

const App = () => {
  const [thumbnails, setThumbnails] = useState([]);
  const [isMotionActive, setIsMotionActive] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [isLoggedIn, setIsLoggedIn] = useState(!!token);
  const [showModal, setShowModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  useEffect(() => {
    if (token) {
      fetchThumbnails();
      const interval = setInterval(fetchThumbnails, 5000); // Poll every 5 seconds
      return () => clearInterval(interval);
    }
  }, [token]);

  const fetchThumbnails = async () => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/thumbnails`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setThumbnails(response.data);
    } catch (error) {
      console.error('Error fetching thumbnails:', error);
    }
  };

  const startMotion = async () => {
    try {
      await axios.post(`${process.env.REACT_APP_API_URL}/start`, {}, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setIsMotionActive(true);
    } catch (error) {
      console.error('Error starting motion:', error);
    }
  };

  const stopMotion = async () => {
    try {
      await axios.post(`${process.env.REACT_APP_API_URL}/stop`, {}, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setIsMotionActive(false);
    } catch (error) {
      console.error('Error stopping motion:', error);
    }
  };

  const handleLogin = async (username, password) => {
    try {
      const response = await axios.post(`${process.env.REACT_APP_API_URL}/login`, { username, password });
      setToken(response.data.token);
      localStorage.setItem('token', response.data.token);
      setIsLoggedIn(true);
      fetchThumbnails();
    } catch (error) {
      console.error('Error logging in:', error);
      alert('Login failed');
    }
  };

  const handleLogout = () => {
    setToken('');
    localStorage.removeItem('token');
    setIsLoggedIn(false);
  };

  const handleImageClick = (src) => {
    setSelectedImage(src);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedImage(null);
  };

  const handleDeleteImage = async (fileName) => {
    try {
      await axios.delete(`${process.env.REACT_APP_API_URL}/captures/${fileName}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      // Refresh thumbnails after deletion
      fetchThumbnails();
    } catch (error) {
      console.error('Error deleting image:', error);
    }
  };

  if (!isLoggedIn) {
    return <LoginForm onLogin={handleLogin} />;
  }

  return (
    <div className="App">
      <h1>Webcam Live Feed</h1>
      <div className="video-container">
        <img src={process.env.REACT_APP_LIVE_URL} alt="Live Feed" />
      </div>
      <div className="controls">
        <button onClick={startMotion} disabled={isMotionActive}>Start Motion Detection</button>
        <button onClick={stopMotion} disabled={!isMotionActive}>Stop Motion Detection</button>
        <button onClick={handleLogout}>Logout</button>
      </div>
      <h2>Captured Images</h2>
      <div className="thumbnails-container">
      {thumbnails.map((capture, index) => (
        <div key={index} className="thumbnail-wrapper">
          <AuthenticatedImage
            src={`${process.env.REACT_APP_API_URL}/thumbnails/${capture}`}
            alt="Capture"
            onClick={() => handleImageClick(`${process.env.REACT_APP_API_URL}/captures/${capture}`)}
          />
          <button onClick={() => handleDeleteImage(capture)}>Delete</button>
        </div>
      ))}
      </div>
      {showModal && (
        <Modal show={showModal} onClose={handleCloseModal}>
          <AuthenticatedImage src={selectedImage} alt="Enlarged Capture" fullScreen />
        </Modal>
      )}
    </div>
  );
};

const AuthenticatedImage = ({ src, alt, onClick, fullScreen }) => {
  const [imageSrc, setImageSrc] = useState('');

  useEffect(() => {
    const fetchImage = async () => {
      const token = localStorage.getItem('token');
      try {
        const response = await axios.get(src, {
          headers: {
            Authorization: `Bearer ${token}`
          },
          responseType: 'blob'
        });
        const url = URL.createObjectURL(response.data);
        setImageSrc(url);

        // Clean up the URL.createObjectURL
        return () => {
          URL.revokeObjectURL(url);
        };
      } catch (error) {
        console.error('Error fetching image:', error);
      }
    };

    fetchImage();
  }, [src]);

  return (
    <img
      src={imageSrc}
      alt={alt}
      onClick={onClick}
      style={fullScreen ? { width: '100%', height: '100%' } : {}}
    />
  );
};

const LoginForm = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onLogin(username, password);
  };

  return (
    <form onSubmit={handleSubmit} className="login-form">
      <div>
        <label>Username:</label>
        <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} />
      </div>
      <div>
        <label>Password:</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <button type="submit">Login</button>
    </form>
  );
};

export default App;
