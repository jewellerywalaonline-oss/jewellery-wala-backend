// routes/web/contact.routes.js
const express = require('express');
const router = express.Router();
const { contact } = require('../../controller/web/contact.controller');
const { uploadNone } = require('../../middleware/uploadMiddleware');

router.post(
    '/',
    uploadNone,
    contact
);

module.exports = router;