// Classic-worker compatibility script for providers
(function(scope){
  'use strict';
  scope.registerAIModern = async function registerAIModern() {
    try {
      importScripts('js/ai/providers/none.js');
    } catch (e) {}
    try {
      importScripts('js/ai/providers/ollama.js');
    } catch (e) {}
    try {
      importScripts('js/ai/providers/webllm.js');
    } catch (e) {}
    return true;
  };
  // call immediately for classic workers
  try { scope.registerAIModern && scope.registerAIModern(); } catch (e) {}
})(self);
