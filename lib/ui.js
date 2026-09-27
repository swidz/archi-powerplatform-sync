/* Native SWT checkbox tables. Selection survives filtering and sorting; no browser dependency. */
var PPUI=(function(){
    "use strict";
    var C=PPCore,SWT=Java.type("org.eclipse.swt.SWT"),Shell=Java.type("org.eclipse.swt.widgets.Shell"),Label=Java.type("org.eclipse.swt.widgets.Label"),Text=Java.type("org.eclipse.swt.widgets.Text"),
        Button=Java.type("org.eclipse.swt.widgets.Button"),Table=Java.type("org.eclipse.swt.widgets.Table"),TableColumn=Java.type("org.eclipse.swt.widgets.TableColumn"),TableItem=Java.type("org.eclipse.swt.widgets.TableItem"),
        Composite=Java.type("org.eclipse.swt.widgets.Composite"),GridLayout=Java.type("org.eclipse.swt.layout.GridLayout"),GridData=Java.type("org.eclipse.swt.layout.GridData");
    function fill(both){return new GridData(SWT.FILL,both?SWT.FILL:SWT.CENTER,true,!!both);}
    function picker(title,description,rows,columns,selected,allowStage,allowEmpty){
        var parent=typeof shell!=="undefined"&&shell?shell:Java.type("org.eclipse.swt.widgets.Display").getDefault();
        var dialog=new Shell(parent,SWT.DIALOG_TRIM|SWT.APPLICATION_MODAL|SWT.RESIZE),chosen=Object.create(null),result=null,sortField=columns[0].field,descending=false;
        selected.forEach(function(id){chosen[id]=true;});dialog.setText(title);dialog.setLayout(new GridLayout(1,false));
        var info=new Label(dialog,SWT.WRAP);info.setText(description);info.setLayoutData(fill(false));
        var search=new Text(dialog,SWT.BORDER|SWT.SEARCH|SWT.ICON_SEARCH|SWT.ICON_CANCEL);search.setMessage("Search names, types, stages, or IDs");search.setLayoutData(fill(false));
        var toolbar=new Composite(dialog,SWT.NONE);toolbar.setLayout(new GridLayout(allowStage?4:3,false));toolbar.setLayoutData(fill(false));
        var all=new Button(toolbar,SWT.PUSH);all.setText("Select filtered");var clear=new Button(toolbar,SWT.PUSH);clear.setText("Clear selection");
        var stage;if(allowStage){stage=new Button(toolbar,SWT.PUSH);stage.setText("Set stage for checked");}
        var count=new Label(toolbar,SWT.NONE);count.setLayoutData(fill(false));
        var table=new Table(dialog,SWT.CHECK|SWT.BORDER|SWT.FULL_SELECTION|SWT.V_SCROLL|SWT.H_SCROLL|SWT.MULTI);table.setHeaderVisible(true);table.setLinesVisible(true);table.setLayoutData(fill(true));
        columns.forEach(function(c){var col=new TableColumn(table,SWT.NONE);col.setText(c.title);col.setWidth(c.width);col.addListener(SWT.Selection,function(){descending=sortField===c.field?!descending:false;sortField=c.field;render();});});
        var buttons=new Composite(dialog,SWT.NONE);buttons.setLayout(new GridLayout(2,true));buttons.setLayoutData(new GridData(SWT.END,SWT.CENTER,false,false));
        var ok=new Button(buttons,SWT.PUSH);ok.setText("Continue");var cancel=new Button(buttons,SWT.PUSH);cancel.setText("Cancel");
        function visible(){var q=C.lower(search.getText()).trim();return rows.filter(function(r){return !q||columns.some(function(c){return C.lower(r[c.field]).indexOf(q)>=0;});}).sort(function(a,b){var n=C.text(a[sortField]).localeCompare(C.text(b[sortField]));return descending?-n:n;});}
        function refreshCount(){var n=rows.filter(function(r){return chosen[r.id]&&r.available!==false;}).length;count.setText(n+" selected / "+rows.length+" listed");ok.setEnabled(allowEmpty||n>0);toolbar.layout();}
        function render(){table.setRedraw(false);try{table.removeAll();visible().forEach(function(r){var item=new TableItem(table,SWT.NONE);item.setData(r.id);item.setText(Java.to(columns.map(function(c){return C.text(r[c.field]);}),"java.lang.String[]"));item.setChecked(!!chosen[r.id]&&r.available!==false);if(r.available===false)item.setForeground(dialog.getDisplay().getSystemColor(SWT.COLOR_DARK_GRAY));});}finally{table.setRedraw(true);}refreshCount();}
        table.addListener(SWT.Selection,function(e){if(Number(e.detail)!==Number(SWT.CHECK))return;var id=String(e.item.getData()),row=rows.filter(function(r){return r.id===id;})[0];if(row.available===false){e.item.setChecked(false);delete chosen[id];}else chosen[id]=!!e.item.getChecked();refreshCount();});
        search.addListener(SWT.Modify,render);all.addListener(SWT.Selection,function(){visible().forEach(function(r){if(r.available!==false)chosen[r.id]=true;});render();});
        clear.addListener(SWT.Selection,function(){chosen=Object.create(null);render();});
        if(stage)stage.addListener(SWT.Selection,function(){var v=window.promptSelection("Architecture stage for checked environments",["Unassigned","DEV","TEST","UAT","PROD","TRAINING","BACKUP"]);if(v!==null){rows.forEach(function(r){if(chosen[r.id])r.stage=String(v)==="Unassigned"?"":String(v);});render();}});
        ok.addListener(SWT.Selection,function(){result=rows.filter(function(r){return chosen[r.id]&&r.available!==false;});dialog.close();});cancel.addListener(SWT.Selection,function(){dialog.close();});
        dialog.setDefaultButton(ok);dialog.setSize(1100,620);render();dialog.open();search.setFocus();
        var display=dialog.getDisplay();while(!dialog.isDisposed()){if(!display.readAndDispatch())display.sleep();}return result;
    }
    function environments(discovery,saved,settings){
        var rows=discovery.environments.map(function(e){return Object.assign({},e,{stage:(settings[e.id]||{}).stage||"",dataverse:e.url?"Available":e.hasDataverse?"URL unavailable":"None",access:e.available?(e.isUserSysAdmin?"Dataverse admin":"Details checked on sync"):(e.state||"Unavailable")});});
        saved.forEach(function(id){if(!rows.some(function(e){return e.id===id;}))rows.push({id:id,name:"Previously selected environment",available:false,access:"Not returned by discovery"});});
        return picker("Select Power Platform environments","Choose the environments to synchronize. Newly discovered environments are unchecked. Deselecting an environment preserves its existing model content.",rows,[
            {title:"Environment",field:"name",width:260},{title:"Type",field:"type",width:90},{title:"Stage",field:"stage",width:80},{title:"Region",field:"region",width:90},
            {title:"Dataverse",field:"dataverse",width:120},{title:"Access / state",field:"access",width:160},{title:"Environment ID",field:"id",width:280}],saved,true,false);
    }
    function roles(candidates,saved){
        var rows=candidates.map(function(c){return {id:c.object.key,name:c.object.name,environment:c.object.environmentName,classification:c.object.roleClassification,managed:c.object.isManaged?"Yes":"No",roleId:c.object.id,selected:c.selected};});
        return picker("Select custom Dataverse security roles","Review candidate roles. Managed/unmanaged status alone does not prove that a role is custom. Known template and system-generated roles are excluded unless explicitly configured.",rows,[
            {title:"Role",field:"name",width:260},{title:"Environment",field:"environment",width:240},{title:"Classification",field:"classification",width:190},{title:"Managed",field:"managed",width:70},{title:"Role ID",field:"roleId",width:280}],
            C.unique(saved.concat(rows.filter(function(r){return r.selected;}).map(function(r){return r.id;}))),false,true);
    }
    function preview(plan){
        var c=plan.counts;
        var summary="Objects: "+c.create+" create, "+c.update+" update, "+c.restore+" restore, "+c.deleted+" mark deleted.\n"+
            "Unverified missing objects preserved: "+c.missing+"\nRelationships: "+c.relationshipsCreate+" create, "+c.relationshipsUpdate+" update, "+c.relationshipsDeleted+" mark deleted.\n"+
            "Existing manual relationships reused: "+c.manualReused+"\nWarnings: "+plan.warnings.length+"; unresolved references: "+plan.unresolved.length+"\n\n"+
            "Folders: "+plan.options.rootFolderName+" / Environment\nReview the details in the Scripts output before applying. The model will remain unsaved.";
        var skipped=Object.keys(plan.ignored||{}).reduce(function(n,k){return n+plan.ignored[k];},0);
        var batch=plan.scope&&plan.scope.contexts,detail=batch?" / "+batch.length+" selected "+(plan.scope.action==="get-solutions"?"environment(s)":"solution(s)")+" across "+C.unique(batch.map(function(c){return c.environmentId;})).length+" environment(s)":plan.scope&&plan.scope.solutionId?" / solution "+plan.scope.solutionId:"";
        var context=plan.scope?"Scope: "+plan.scope.action+detail+"\nExcluded subtype memberships (e.g. classic workflows): "+skipped+"\n\n":"";
        return window.confirm("Power Platform synchronization preview\n\n"+context+summary+"\n\nApply these changes?");
    }
    function solutions(envs,objects,saved){
        var rows=objects.map(function(o){return {id:o.key,name:o.name,environment:o.environmentName,environmentId:o.environmentId,logicalName:o.logicalName,version:o.version,managed:o.isManaged?"Managed":"Unmanaged",publisher:o.publisher,object:o};});
        var selected=picker("Select solutions — "+envs.length+" environment(s)","Choose solutions to add or refresh. New solutions are unchecked. Deselecting a solution preserves its existing model content.",rows,[
            {title:"Solution",field:"name",width:260},{title:"Environment",field:"environment",width:240},{title:"Unique name",field:"logicalName",width:210},{title:"Version",field:"version",width:120},{title:"Type",field:"managed",width:110},{title:"Publisher",field:"publisher",width:220},{title:"Environment ID",field:"environmentId",width:280}],saved,false,false);
        return selected===null?null:selected.map(function(r){return r.object;});
    }
    return {environments:environments,roles:roles,solutions:solutions,preview:preview,picker:picker};
}());
