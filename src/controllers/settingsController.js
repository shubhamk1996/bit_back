// backend/src/controllers/settingsController.js
const pool = require('../config/db');

exports.getSettings = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT key_name, key_value FROM settings');
    const settings = {};
    rows.forEach(row => {
      settings[row.key_name] = row.key_value;
    });
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const { theme_colors, logo_url } = req.body;
    
    if (theme_colors) {
      await pool.query('UPDATE settings SET key_value = ? WHERE key_name = ?', [JSON.stringify(theme_colors), 'theme_colors']);
    }
    if (logo_url !== undefined) {
      await pool.query('UPDATE settings SET key_value = ? WHERE key_name = ?', [logo_url, 'logo_url']);
    }
    
    res.json({ success: true, message: 'Settings updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
