/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
'use strict';

Application.Services.factory('Setting', ["$resource", $resource=>
  $resource("/api/settings/:name",
    {name: "@name"}, {
    update: {
      method: 'PUT'
    },
    query: {
      isArray: false
    }
  }
  )

]);
