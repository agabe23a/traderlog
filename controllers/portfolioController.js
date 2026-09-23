const service=require('../services/portfolioService');
exports.summary=async(req,res,next)=>{try{res.json({data:await service.summary(req.session.userId)});}catch(e){next(e);}};
exports.accounts=async(req,res,next)=>{try{res.json({data:await service.accounts(req.session.userId)});}catch(e){next(e);}};
exports.createAccount=async(req,res,next)=>{try{res.status(201).json({data:await service.createAccount(req.session.userId,req.body)});}catch(e){next(e);}};
exports.positions=async(req,res,next)=>{try{res.json({data:await service.positions(req.session.userId)});}catch(e){next(e);}};
exports.createPosition=async(req,res,next)=>{try{res.status(201).json({data:await service.createPosition(req.session.userId,req.body)});}catch(e){next(e);}};
exports.updatePosition=async(req,res,next)=>{try{res.json({data:await service.updatePosition(req.session.userId,req.params.id,req.body)});}catch(e){next(e);}};
exports.removePosition=async(req,res,next)=>{try{await service.removePosition(req.session.userId,req.params.id);res.status(204).end();}catch(e){next(e);}};
