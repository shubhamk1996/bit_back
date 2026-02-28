// backend/src/controllers/invoiceController.js - Invoice PDF Generation Controller
const pool = require('../config/db');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

// Generate and download invoice PDF
exports.downloadInvoice = async (req, res) => {
  try {
    const { orderId } = req.params;

    const [orders] = await pool.query(`
      SELECT o.*, u.email,
        me.name as marketing_person_name,
        oe.name as operations_person_name
      FROM orders o
      JOIN users u ON o.user_id = u.id
      LEFT JOIN employees me ON o.marketing_person_id = me.id
      LEFT JOIN employees oe ON o.operations_person_id = oe.id
      WHERE o.id = ?
    `, [orderId]);

    if (orders.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const order = orders[0];
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    // Set response headers
    const invoiceNumber = `INV-${order.order_id}-${Date.now()}`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Invoice-${order.order_id}.pdf`);
    doc.pipe(res);

    // Header background
    doc.rect(0, 0, 612, 120).fill('#1a237e');

    // Company name
    doc.fontSize(28).fillColor('#ffffff').font('Helvetica-Bold')
      .text('INVOICE', 50, 35);
    doc.fontSize(10).fillColor('#bbdefb')
      .text('Admin & Client Management System', 50, 70);
    doc.fontSize(10).fillColor('#ffffff')
      .text(`Invoice #: ${invoiceNumber}`, 350, 35, { align: 'right' });
    doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`, 350, 50, { align: 'right' });
    doc.text(`Order ID: ${order.order_id}`, 350, 65, { align: 'right' });

    // Reset color
    doc.fillColor('#333333');

    // Bill To section
    let y = 140;
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#1a237e').text('BILL TO:', 50, y);
    y += 20;
    doc.fontSize(10).font('Helvetica').fillColor('#333333');
    doc.text(`Company: ${order.company}`, 50, y); y += 15;
    doc.text(`Email: ${order.email}`, 50, y); y += 15;
    doc.text(`Plan: ${order.plan.charAt(0).toUpperCase() + order.plan.slice(1)}`, 50, y); y += 15;
    doc.text(`Payment Date: ${new Date(order.payment_date).toLocaleDateString('en-IN')}`, 50, y); y += 15;
    doc.text(`Next Payment: ${new Date(order.upcoming_payment_date).toLocaleDateString('en-IN')}`, 50, y); y += 15;

    // Team Info
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#1a237e').text('TEAM ASSIGNED:', 350, 140);
    doc.fontSize(10).font('Helvetica').fillColor('#333333');
    doc.text(`Marketing: ${order.marketing_person_name || 'N/A'}`, 350, 160);
    doc.text(`Operations: ${order.operations_person_name || 'N/A'}`, 350, 175);

    // Divider line
    y += 20;
    doc.moveTo(50, y).lineTo(562, y).strokeColor('#1a237e').lineWidth(2).stroke();
    y += 20;

    // Financial Details Table Header
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#1a237e').text('FINANCIAL BREAKDOWN', 50, y);
    y += 25;

    // Table header
    doc.rect(50, y, 512, 25).fill('#e8eaf6');
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#1a237e');
    doc.text('Description', 60, y + 7);
    doc.text('Amount (INR)', 420, y + 7, { align: 'right', width: 130 });
    y += 30;

    // Table rows
    const rows = [
      ['Total Amount (100%)', order.amount],
      ['Hosting Charges (50%)', order.hosting_charges],
      ['Payments (16%)', order.payments],
      ['Incentive (8%)', order.incentive],
      ['Office Expenses (4%)', order.office_expenses],
      ['Extraordinary (4%)', order.extraordinary],
      ['Gross Margin', order.gross_margin],
      ['Net Profit (18%)', order.net_profit],
    ];

    doc.font('Helvetica').fillColor('#333333');
    rows.forEach((row, index) => {
      if (index % 2 === 0) {
        doc.rect(50, y - 3, 512, 22).fill('#f5f5f5');
        doc.fillColor('#333333');
      }
      doc.fontSize(10).text(row[0], 60, y);
      doc.text(`Rs. ${parseFloat(row[1]).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 420, y, { align: 'right', width: 130 });
      y += 22;
    });

    // Dividends section
    y += 10;
    doc.moveTo(50, y).lineTo(562, y).strokeColor('#ccc').lineWidth(1).stroke();
    y += 15;
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#1a237e').text('DIVIDEND DISTRIBUTION', 50, y);
    y += 20;

    const dividends = [
      ['Sumit (50% of Net Profit)', order.dividend_sumit],
      ['Abhay (40% of Net Profit)', order.dividend_abhay],
      ['TTD (10% of Net Profit)', order.dividend_ttd],
    ];

    doc.font('Helvetica').fillColor('#333333');
    dividends.forEach((row, index) => {
      if (index % 2 === 0) {
        doc.rect(50, y - 3, 512, 22).fill('#f5f5f5');
        doc.fillColor('#333333');
      }
      doc.fontSize(10).text(row[0], 60, y);
      doc.text(`Rs. ${parseFloat(row[1]).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 420, y, { align: 'right', width: 130 });
      y += 22;
    });

    // Total
    y += 10;
    doc.rect(50, y, 512, 30).fill('#1a237e');
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#ffffff');
    doc.text('TOTAL AMOUNT', 60, y + 8);
    doc.text(`Rs. ${parseFloat(order.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 420, y + 8, { align: 'right', width: 130 });

    // Footer
    y += 60;
    doc.fontSize(8).font('Helvetica').fillColor('#999999');
    doc.text('This is a computer-generated invoice. No signature required.', 50, y, { align: 'center' });
    doc.text(`Generated on ${new Date().toLocaleString('en-IN')}`, 50, y + 12, { align: 'center' });

    // Save invoice record (non-blocking)
    pool.query(
      'INSERT INTO invoices (invoice_number, order_id, generated_by, total_amount) VALUES (?, ?, ?, ?)',
      [invoiceNumber, orderId, req.user ? req.user.id : null, order.amount]
    ).catch(e => console.error('Failed to record internal invoice in DB:', e.message));

    doc.end();
  } catch (error) {
    console.error('Invoice generation error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Generate and download client-facing invoice (simplified)
exports.downloadClientInvoice = async (req, res) => {
  try {
    const { orderId } = req.params;

    const [orders] = await pool.query(`
      SELECT o.*, u.email
      FROM orders o
      JOIN users u ON o.user_id = u.id
      WHERE o.id = ?
    `, [orderId]);

    if (orders.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const order = orders[0];
    
    // Authorization check: only admin or the client themselves
    const isClient = req.user.id == order.user_id;
    const isAdmin = req.user.role_name === 'admin';
    
    if (!isAdmin && !isClient) {
      console.warn(`Unauthorized invoice download attempt: user ${req.user.id} tried to download order ${orderId} belonging to user ${order.user_id}`);
      return res.status(403).json({ success: false, message: 'Unauthorized access to this invoice' });
    }

    const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });

    // Handle errors during PDF generation
    doc.on('error', (err) => {
      console.error('PDF generation internal error:', err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: 'Failed to generate PDF' });
      }
    });

    // Set response headers
    const invoiceNumber = `INV-CLT-${order.order_id}-${Date.now()}`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Invoice-${order.order_id}.pdf`);
    
    doc.pipe(res);

    // Header background
    doc.rect(0, 0, 612, 100).fill('#2c3e50');

    // Company info
    doc.fontSize(24).fillColor('#ffffff').font('Helvetica-Bold')
      .text('INVOICE', 50, 30);
    doc.fontSize(10).fillColor('#ecf0f1')
      .text('Professional Services', 50, 60);
    doc.fontSize(10).fillColor('#ffffff')
      .text(`Invoice #: ${invoiceNumber}`, 350, 30, { align: 'right' });
    doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`, 350, 45, { align: 'right' });

    // Reset color
    doc.fillColor('#333333');

    // Bill To section
    let y = 120;
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#2c3e50').text('BILL TO:', 50, y);
    y += 18;
    doc.fontSize(10).font('Helvetica').fillColor('#333333');
    doc.text(`Client: ${order.client_name || 'Valued Client'}`, 50, y); y += 15;
    doc.text(`Company: ${order.company || 'N/A'}`, 50, y); y += 15;
    doc.text(`Email: ${order.email || 'N/A'}`, 50, y); y += 15;

    // Order Details
    y = 120;
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#2c3e50').text('ORDER INFO:', 350, y);
    y += 18;
    doc.fontSize(10).font('Helvetica').fillColor('#333333');
    doc.text(`Order ID: ${order.order_id}`, 350, y); y += 15;
    doc.text(`Payment Status: ${order.status === 'active' ? 'PAID' : 'PENDING'}`, 350, y); y += 15;
    doc.text(`Payment Date: ${order.payment_date ? new Date(order.payment_date).toLocaleDateString('en-IN') : '-'}`, 350, y); y += 15;

    // Table Header
    y = 220;
    doc.rect(50, y, 512, 25).fill('#34495e');
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#ffffff');
    doc.text('Description', 60, y + 7);
    doc.text('Qty', 300, y + 7);
    doc.text('Rate', 380, y + 7, { align: 'right', width: 80 });
    doc.text('Amount', 480, y + 7, { align: 'right', width: 80 });
    y += 35;

    // Table Rows
    const planStr = order.plan ? (order.plan.charAt(0).toUpperCase() + order.plan.slice(1)) : 'Service';
    const planName = `${planStr} Plan ${order.subplan ? `(${order.subplan.toUpperCase()})` : ''}`;

    const totalAmt = parseFloat(order.amount || 0);
    const baseAmt = totalAmt / 1.18;
    const taxAmt = totalAmt - baseAmt;

    doc.font('Helvetica').fillColor('#333333');
    doc.text(planName, 60, y);
    doc.text('1', 300, y);
    
    doc.text(`Rs. ${baseAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 380, y, { align: 'right', width: 80 });
    doc.text(`Rs. ${baseAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 480, y, { align: 'right', width: 80 });
    y += 25;

    // Divider
    doc.moveTo(50, y).lineTo(562, y).strokeColor('#ccc').lineWidth(1).stroke();
    y += 15;

    // Summary
    doc.fontSize(10).font('Helvetica').text('Subtotal:', 380, y, { align: 'right', width: 80 });
    doc.text(`Rs. ${baseAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 480, y, { align: 'right', width: 80 });
    y += 20;

    doc.text('Tax (GST 18%):', 380, y, { align: 'right', width: 80 });
    doc.text(`Rs. ${taxAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 480, y, { align: 'right', width: 80 });
    y += 25;

    doc.fontSize(12).font('Helvetica-Bold').fillColor('#2c3e50');
    doc.text('TOTAL:', 380, y, { align: 'right', width: 80 });
    doc.text(`Rs. ${totalAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 480, y, { align: 'right', width: 80 });

    // Footer
    y = 750;
    doc.fontSize(8).font('Helvetica').fillColor('#95a5a6');
    doc.text('Thank you for your business!', 50, y, { align: 'center' });
    doc.text('This is a computer-generated invoice. No signature required.', 50, y + 12, { align: 'center' });

    // Save invoice record for audit
    try {
      await pool.query(
        'INSERT INTO invoices (invoice_number, order_id, generated_by, total_amount) VALUES (?, ?, ?, ?)',
        [invoiceNumber, orderId, req.user ? req.user.id : null, totalAmt]
      );
    } catch (e) {
      console.error('Failed to record client invoice in DB:', e.message);
    }

    doc.end();
  } catch (error) {
    console.error('Client invoice generation error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get all invoices
exports.getAllInvoices = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT i.*, o.order_id as order_code, o.company
      FROM invoices i
      JOIN orders o ON i.order_id = o.id
      ORDER BY i.created_at DESC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
