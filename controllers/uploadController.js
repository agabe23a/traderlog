exports.screenshots=(req,res)=>res.status(201).json({files:(req.files||[]).map(f=>({url:`/uploads/${f.filename}`,size:f.size,mime:f.mimetype}))});
