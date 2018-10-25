/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
'use strict';

Application.Services.factory('Export', ["$http", $http=>
  ({
    status(query) {
      return $http.post('/api/exports/status', query);
    }
  })

]);
