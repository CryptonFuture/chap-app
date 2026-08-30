const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedImages = /jpeg|jpg|png|gif|webp/;
  const allowedDocs = /pdf|doc|docx|txt|zip|rar|xls|xlsx|ppt|pptx/;
  const ext = path.extname(file.originalname).toLowerCase().slice(1);
  const mimetype = file.mimetype;

  if (
    allowedImages.test(ext) ||
    allowedDocs.test(ext) ||
    mimetype.startsWith('image/') ||
    mimetype === 'application/pdf' ||
    mimetype.includes('document') ||
    mimetype.includes('text') ||
    mimetype.includes('zip') ||
    mimetype.includes('rar')
  ) {
    cb(null, true);
  } else {
    cb(new Error('File type not allowed. Allowed: images, PDF, docs, zip'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

module.exports = upload;
