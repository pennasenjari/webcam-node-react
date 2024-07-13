require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { exec, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sharp = require('sharp');

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
const thumbnailsDir = path.join(__dirname, 'thumbnails');

// Middleware
app.use(bodyParser.json());
app.use(cors({
  exposedHeaders: ['Authorization'], // Expose the Authorization header
}));
app.use(express.static('public'));

// Ensure directories exist
if (!fs.existsSync(capturesDir)) {
  fs.mkdirSync(capturesDir);
}
if (!fs.existsSync(thumbnailsDir)) {
  fs.mkdirSync(thumbnailsDir);
}

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
    // console.log(`Motion stdout: ${stdout}`);
    console.log('Motion detection started.');
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

// Serve thumbnail images
app.get('/thumbnails', authenticateJWT, (req, res) => {
  fs.readdir(thumbnailsDir, (err, files) => {
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
    res.setHeader('Content-Type', 'image/jpeg');
    res.send(data);
  });
});

// Endpoint to delete an image
app.delete('/captures/:fileName', authenticateJWT, (req, res) => {
  const { fileName } = req.params;
  const imagePath = path.join(capturesDir, fileName);
  const thumbnailPath = path.join(thumbnailsDir, fileName);

  // Delete the image file
  fs.unlink(imagePath, (err) => {
    if (err) {
      console.error('Error deleting image:', err);
      return res.status(500).send('Failed to delete image');
    }

    // Delete the thumbnail file
    fs.unlink(thumbnailPath, (err) => {
      if (err) {
        console.error('Error deleting thumbnail:', err);
        return res.status(500).send('Failed to delete thumbnail');
      }

      res.status(200).send('Image and thumbnail deleted successfully');
    });
  });
});


// Serve individual thumbnail images
app.get('/thumbnails/:fileName', authenticateJWT, (req, res) => {
  const { fileName } = req.params;
  const filePath = path.join(thumbnailsDir, fileName);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      return res.status(404).send('File not found');
    }
    res.setHeader('Content-Type', 'image/jpeg');
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

// Endpoint to save captured images
app.post('/capture/image', authenticateJWT, async (req, res) => {
  const imageData = Buffer.from(req.body.imageData, 'base64'); // Assuming imageData is base64 encoded
  const imageName = `capture_${Date.now()}.jpg`; 
  const imagePath = path.join(capturesDir, imageName);
  const thumbnailPath = path.join(thumbnailsDir, `thumb_${imageName}`);

  try {
    // Save full-size image
    await sharp(imageData)
      .resize(800, 600) // Resize to full resolution if needed
      .toFile(imagePath);

    console.log('Image saved successfully:', imageName);

    // Save thumbnail image
    await sharp(imageData)
      .resize(120, 80) // Resize to thumbnail resolution
      .toFile(thumbnailPath);

    console.log('Thumbnail saved successfully:', thumbnailPath);
    
    limitCaptures(); // Ensure only last 10 images are kept
    res.status(200).send('Image saved');
  } catch (err) {
    console.error('Error saving image:', err);
    res.status(500).send('Failed to save image');
  }
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

      // Also delete the corresponding thumbnails
      fs.unlink(path.join(thumbnailsDir, file), err => {
        if (err) {
          console.error('Error deleting thumbnail:', err);
        } else {
          console.log('Deleted old thumbnail:', file);
        }
      });
    });
  });
}

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
