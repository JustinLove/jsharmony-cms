//(routetype, req, res, callback, require, jsh, modelid, params)

var _ = require('lodash');
var Helper = require('../Helper.js');
var ejsext = require('../lib/ejsext.js');
var cms = jsh.Modules['jsHarmonyCMS'];
var dbtypes = jsh.AppSrv.DB.types;

if(routetype == 'd'){
  jsh.AppSrv.ExecRow(req._DBContext, "select deployment_target_params from {schema}.v_my_branch_desc left outer join {schema}.v_my_site on v_my_site.site_id = v_my_branch_desc.site_id where branch_id={schema}.my_current_branch_id()", [], { }, function (err, rslt) {
    if (err) { jsh.Log.error(err); Helper.GenError(req, res, -99999, "An unexpected error has occurred"); return; }

    var root_txt = '(Root)';
    if (rslt && rslt.length && rslt[0]) {
      var deployment_target_params = rslt[0].deployment_target_params;
      try{
        if(deployment_target_params) deployment_target_params = JSON.parse(deployment_target_params);
        else deployment_target_params = {};
      }
      catch(ex){
        jsh.Log.error('Publish Target has invalid deployment_target_params: '+deployment_target_params);
        return;
      }
      deployment_target_params = _.extend({}, cms.Config.deployment_target_params, deployment_target_params);
      if(deployment_target_params.page_subfolder){
        root_txt += '/' + deployment_target_params.page_subfolder;
        if(root_txt[root_txt.length-1] == '/') root_txt = root_txt.substr(0, root_txt.length - 1);
      }
    }

    var model = jsh.getModelClone(req, modelid);
    var treeField = jsh.AppSrvClass.prototype.getFieldByName(model.fields, 'page_folder');
    if(treeField) treeField.lov.post_process = Helper.ReplaceAll(treeField.lov.post_process, '%%%ROOT%%%', root_txt);

    //Save model to local request cache
    req.jshlocal.Models[modelid] = model;
    return callback();
  });
}
else if(routetype == 'model'){
  var model = jsh.getModel(req, modelid);
  if (!Helper.hasModelAction(req, model, 'B')) { Helper.GenError(req, res, -11, 'Invalid Model Access'); return; }

  let query = undefined;
  let pTypes = undefined;
  let qParams = undefined;
  if(req.query.init_page_key) {
    query = 'select page_folder from {schema}.v_my_page where page_key=@page_key';
    pTypes = [dbtypes.BigInt];
    qParams = { page_key: req.query.init_page_key };
  } else if (req.query.init_path) {
    if (!req.query.init_path.endsWith('/')) req.query.init_path = req.query.init_path + '/';
    query = 'select page_folder from {schema}.v_my_page where substr(page_folder, 1, length(@page_folder)) = @page_folder';
    pTypes = [dbtypes.NVarChar(req.query.init_path.length)];
    qParams = { page_folder: req.query.init_path };
  }

  if (query) {
    jsh.AppSrv.ExecRow(req._DBContext, query, pTypes, qParams, function (err, rslt) {
      if(err) callback();
      if(!rslt || !rslt.length || !rslt[0]) return callback();

      var page_folder = rslt[0].page_folder;
      if(!page_folder) return callback();
  
      var state = {};
      state[modelid] = { page_folder: page_folder };
      res.end('***JSHARMONY_REDIRECT***\n'+req.baseurl+modelid+'?state='+encodeURIComponent(JSON.stringify(state)));
      return;
    });
  }
  else return callback();
}
else return callback();
