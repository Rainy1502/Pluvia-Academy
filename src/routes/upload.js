const express = require('express');
const router = express.Router();
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');

// Create Supabase client with SERVICE ROLE key (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Configure multer to use memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit (increased for PDFs)
  fileFilter: function (req, file, cb) {
    const allowedImageTypes = /jpeg|jpg|png|gif|webp/;
    const isPDF = file.mimetype === 'application/pdf';
    const extname = file.originalname.toLowerCase().split('.').pop();
    const isImage = allowedImageTypes.test(extname) && allowedImageTypes.test(file.mimetype);
    
    if (isImage || isPDF) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, GIF, WebP) and PDF files are allowed!'));
    }
  }
});

// Upload image to Supabase Storage
router.post('/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'No file uploaded' 
      });
    }

    const folder = req.body.folder || 'thumbnails';
    const file = req.file;
    const fileExt = file.originalname.split('.').pop();
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    // Upload to Supabase Storage using service role (bypass RLS)
    const { data, error } = await supabaseAdmin.storage
      .from('course-images')
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Supabase upload error:', error);
      throw error;
    }

    // Get public URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('course-images')
      .getPublicUrl(fileName);

    return res.json({
      success: true,
      url: publicUrl,
      message: 'File uploaded successfully'
    });

  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload file'
    });
  }
});

module.exports = router;
