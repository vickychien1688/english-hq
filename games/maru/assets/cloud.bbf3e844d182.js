/* 免登入版：分數只存在這台裝置（localStorage），不連雲端 */
(function(root){
'use strict';
root.MaruCloud=function({onRecords,onState}){
 const load=async id=>{const rec={[id]:MaruCore.loadClass(localStorage,id)};onRecords(rec);onState('saved');return rec};
 return {save(){onState('saved')},flush:async()=>{},loadAll:async()=>({}),loadClass:load,loadGroup:async()=>({}),
  rankings:async()=>[],resolveConflict:async()=>{},conflictId:()=>undefined,hasPending:()=>false};
};
})(window);
