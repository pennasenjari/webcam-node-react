import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const App = () => {
  const [captures, setCaptures] = useState([]);
  const [isMotionActive, setIsMotionActive] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [isLoggedIn, setIsLoggedIn] = useState(!!token);

  const videoUrl = process.env.REACT_APP_LIVE_URL || 'http://vattu.ddns.net:8081';

  useEffect(() => {
    if (token) {
      fetchCaptures();
    }
  }, [token]);

  const fetchCaptures = async () => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/captures`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setCaptures(response.data);
    } catch (error) {
      console.error('Error fetching captures:', error);
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
      const response = await axios.post(`${process.env.REACT_APP_API_URL}/login`, {
        username,
        password
      });
      setToken(response.data.token);
      localStorage.setItem('token', response.data.token);
      setIsLoggedIn(true);
      fetchCaptures();
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

  if (!isLoggedIn) {
    return <LoginForm onLogin={handleLogin} />;
  }

  return (
    <div className="App">
      <h1>Webcam Live Feed</h1>

      <div className="video-container">
        <img src={videoUrl} width="320" height="240" />
      </div>

      <div className="controls">
        <button onClick={startMotion} disabled={isMotionActive}>Start Motion Detection</button>
        <button onClick={stopMotion} disabled={!isMotionActive}>Stop Motion Detection</button>
        <button onClick={handleLogout}>Logout</button>
      </div>
      <h2>Captured Images</h2>
      <div className="captures-container">
        {captures.map((capture, index) => (
          <AuthenticatedImage key={index} src={`${process.env.REACT_APP_API_URL}/captures/${capture}`} alt="Capture" />
        ))}
      </div>
    </div>
  );
};

const AuthenticatedImage = ({ src, alt }) => {
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
      } catch (error) {
        console.error('Error fetching image:', error);
      }
    };

    fetchImage();
  }, [src]);

  return <img src={imageSrc} alt={alt} />;
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
