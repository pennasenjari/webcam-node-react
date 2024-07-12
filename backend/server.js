require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { exec, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const port = 3001;
const SECRET_KEY = 'your_secret_key';  // Change this to a secure key in production

// (temporary) Authentication setup
const users = [
  {
    id: 1,
    username: process.env.REACT_APP_USERNAME,
    password: bcrypt.hashSync(process.env.REACT_APP_PASSWORD, 8)
  }
];

let motionProcess = null;

// Directory to store captures
const capturesDir = path.join(__dirname, 'captures');

// Middleware
app.use(bodyParser.json());
app.use(cors({
  exposedHeaders: ['Authorization'], // Expose the Authorization header
}));
app.use(express.static('public'));

// Function definitions...
const startMotion = () => {
  const motionConfPath = path.join(__dirname, 'config', 'motion.conf');
  motionProcess = exec(`motion -c ${motionConfPath}`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error starting motion: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`Motion stderr: ${stderr}`);
      return;
    }
    console.log(`Motion stdout: ${stdout}`);
  });
};

const stopMotion = () => {
  if (motionProcess) {
    try {
      execSync('pkill motion');
      motionProcess = null;
      console.log('Motion detection stopped.');
    } catch (err) {
      console.error('Error stopping motion:', err);
    }
  } else {
    console.log('No motion process to stop.');
  }
};

// Start motion detection initially
startMotion();

// Middleware to authenticate requests
const authenticateJWT = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (token) {
    jwt.verify(token, SECRET_KEY, (err, user) => {
      if (err) {
        return res.sendStatus(403);
      }
      req.user = user;
      next();
    });
  } else {
    res.sendStatus(401);
  }
};

// Authentication routes
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username);
  if (user && bcrypt.compareSync(password, user.password)) {
    const token = jwt.sign({ username: user.username, id: user.id }, SECRET_KEY, { expiresIn: '1h' });
    res.json({ token });
  } else {
    res.status(401).send('Username or password incorrect');
  }
});

// Serve captured images
app.get('/captures', authenticateJWT, (req, res) => {
  fs.readdir(capturesDir, (err, files) => {
    if (err) {
      return res.status(500).send('Unable to scan captures directory');
    }
    res.json(files);
  });
});

// Serve individual captured images
app.get('/captures/:fileName', authenticateJWT, (req, res) => {
  const { fileName } = req.params;
  const filePath = path.join(capturesDir, fileName);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      return res.status(404).send('File not found');
    }
    res.setHeader('Content-Type', 'application/octet-stream');
    res.send(data);
  });
});

// Endpoint to start motion detection
app.post('/start', authenticateJWT, (req, res) => {
  startMotion();
  res.status(200).send('Motion detection started');
});

// Endpoint to stop motion detection
app.post('/stop', authenticateJWT, (req, res) => {
  stopMotion();
  res.status(200).send('Motion detection stopped');
});

// Example route to save captured images (POST request)
app.post('/capture/image', authenticateJWT, (req, res) => {
  const imageData = req.body.imageData; // Assuming imageData is sent in the request
  const imageName = `capture_${Date.now()}.jpg`; // Example filename generation
  const imagePath = path.join(capturesDir, imageName);

  fs.writeFile(imagePath, imageData, (err) => {
    if (err) {
      console.error('Error saving image:', err);
      return res.status(500).send('Failed to save image');
    }
    console.log('Image saved successfully:', imageName);
    limitCaptures(); // Ensure only last 10 images are kept
    res.status(200).send('Image saved');
  });
});

// Function to limit images to the last 10
function limitCaptures() {
  fs.readdir(capturesDir, (err, files) => {
    if (err) {
      console.error('Unable to scan captures directory:', err);
      return;
    }

    // Sort files by creation time
    files.sort((a, b) => {
      return fs.statSync(path.join(capturesDir, a)).mtime.getTime() - fs.statSync(path.join(capturesDir, b)).mtime.getTime();
    });

    // Keep only the last 10 files
    const filesToDelete = files.slice(0, files.length - 10);
    filesToDelete.forEach(file => {
      fs.unlink(path.join(capturesDir, file), err => {
        if (err) {
          console.error('Error deleting file:', err);
        } else {
          console.log('Deleted old capture:', file);
        }
      });
    });
  });
}

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
