const multer=require('multer');const crypto=require('crypto');const fs=require('fs');const path=require('path');
const dir=process.env.UPLOAD_DIR ? path.resolve(process.env.UPLOAD_DIR) : path.join(__dirname,'../public/uploads');fs.mkdirSync(dir,{recursive:true});
const allowed=new Set(['image/jpeg','image/png','image/webp','image/gif']);
const storage=multer.diskStorage({destination:dir,filename:(req,file,cb)=>cb(null,`${crypto.randomUUID()}.${file.mimetype.split('/')[1]}`)});
const upload=multer({storage,limits:{fileSize:5*1024*1024,files:5},fileFilter:(req,file,cb)=>cb(allowed.has(file.mimetype)?null:Object.assign(new Error('Only JPEG, PNG, WebP or GIF images are allowed'),{status:400}),allowed.has(file.mimetype))});
module.exports={upload};
