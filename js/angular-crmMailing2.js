(function (angular, $, _) {
  var partialUrl = function (relPath) {
    return CRM.resourceUrls['civicrm'] + '/partials/crmMailing2/' + relPath;
  };

  var crmMailing2 = angular.module('crmMailing2', ['ngRoute', 'ui.utils', 'crmUi', 'dialogService']); // TODO ngSanitize, unsavedChanges

  // Time to wait before triggering AJAX update to recipients list
  var RECIPIENTS_DEBOUNCE_MS = 100;
  var RECIPIENTS_PREVIEW_LIMIT = 10000;

  crmMailing2.config(['$routeProvider',
    function ($routeProvider) {
      $routeProvider.when('/mailing2', {
        template: '<div></div>',
        controller: 'ListMailingsCtrl'
      });
      $routeProvider.when('/mailing2/:id', {
        templateUrl: partialUrl('edit.html'),
        controller: 'EditMailingCtrl',
        resolve: {
          selectedMail: function($route, crmMailingMgr) { return crmMailingMgr.getOrCreate($route.current.params.id); }
        }
      });
      $routeProvider.when('/mailing2/:id/unified', {
        templateUrl: partialUrl('edit-unified.html'),
        controller: 'EditMailingCtrl',
        resolve: {
          selectedMail: function($route, crmMailingMgr) { return crmMailingMgr.getOrCreate($route.current.params.id); }
        }
      });
      $routeProvider.when('/mailing2/:id/unified2', {
        templateUrl: partialUrl('edit-unified2.html'),
        controller: 'EditMailingCtrl',
        resolve: {
          selectedMail: function($route, crmMailingMgr) { return crmMailingMgr.getOrCreate($route.current.params.id); }
        }
      });
      $routeProvider.when('/mailing2/:id/wizard', {
        templateUrl: partialUrl('edit-wizard.html'),
        controller: 'EditMailingCtrl',
        resolve: {
          selectedMail: function($route, crmMailingMgr) { return crmMailingMgr.getOrCreate($route.current.params.id); }
        }
      });
    }
  ]);

  crmMailing2.controller('ListMailingsCtrl', function ($scope) {
    // We haven't implemented this in Angular, but some users may get clever
    // about typing URLs, so we'll provide a redirect.
    window.location = CRM.url('civicrm/mailing/browse/unscheduled', {
      reset: 1,
      scheduled: 'false'
    });
  });

  crmMailing2.controller('EditMailingCtrl', function ($scope, selectedMail) {
    $scope.mailing = selectedMail;
    $scope.crmMailingConst = CRM.crmMailing;

    $scope.partialUrl = partialUrl;
    $scope.ts = CRM.ts('CiviMail');

    $scope.send = function() {
      CRM.alert('Send!');
    };
    $scope.save = function() {
      CRM.alert('Save!');
    };
    $scope.cancel = function() {
      CRM.alert('Cancel!');
    };
    $scope.leave = function() {
      window.location = CRM.url('civicrm/mailing/browse/unscheduled', {
        reset: 1,
        scheduled: 'false'
      });
    };
  });

  // Controller for the edit-recipients fields (
  // WISHLIST: Move most of this to a (cache-enabled) service
  // Scope members:
  //  - [input] mailing: object
  //  - [output] recipients: array of recipient records
  crmMailing2.controller('EditRecipCtrl', function ($scope, dialogService, crmApi, crmMailingMgr) {
    // TODO load & live update real recipients list
    $scope.recipients = null;
    $scope.getRecipientsEstimate = function () {
      var ts = $scope.ts;
      if ($scope.recipients == null)
        return ts('(Estimating)');
      if ($scope.recipients.length == 0)
        return ts('No recipients');
      if ($scope.recipients.length == 1)
        return ts('~1 recipient');
      if (RECIPIENTS_PREVIEW_LIMIT > 0 && $scope.recipients.length >= RECIPIENTS_PREVIEW_LIMIT)
        return ts('>%1 recipients', {1: RECIPIENTS_PREVIEW_LIMIT});
      return ts('~%1 recipients', {1: $scope.recipients.length});
    };
    // We monitor four fields -- use debounce so that changes across the
    // four fields can settle-down before AJAX.
    var refreshRecipients = _.debounce(function () {
      $scope.$apply(function () {
        $scope.recipients = null;
        crmMailingMgr.previewRecipients($scope.mailing, RECIPIENTS_PREVIEW_LIMIT).then(function (recipients) {
          $scope.recipients = recipients;
        });
      });
    }, RECIPIENTS_DEBOUNCE_MS);
    $scope.$watchCollection("mailing.groups.include", refreshRecipients);
    $scope.$watchCollection("mailing.groups.exclude", refreshRecipients);
    $scope.$watchCollection("mailing.mailings.include", refreshRecipients);
    $scope.$watchCollection("mailing.mailings.exclude", refreshRecipients);

    $scope.previewRecipients = function () {
      var model = {
        recipients: $scope.recipients
      };
      var options = {
        autoOpen: false,
        modal: true,
        title: ts('Preview (%1)', {
          1: $scope.getRecipientsEstimate()
        }),
      };
      dialogService.open('recipDialog', partialUrl('dialog/recipients.html'), model, options)
        .then(
          function (result) {
            // console.log('Closed!');
          },
          function (error) {
            // console.log('Cancelled!');
          }
        );
    };
  });

  // Controller for the "Preview Recipients" dialog
  // Note: Expects $scope.model to be an object with properties:
  //   - recipients: array of contacts
  crmMailing2.controller('PreviewRecipCtrl', function ($scope) {
    $scope.ts = CRM.ts('CiviMail');
  });

  // Controller for the "Preview Mailing" segment
  // Note: Expects $scope.model to be an object with properties:
  //   - mailing: object
  crmMailing2.controller('PreviewMailingCtrl', function ($scope, dialogService, crmMailingMgr) {
    $scope.ts = CRM.ts('CiviMail');
    $scope.testContact = {email: ''};
    $scope.testGroup = {gid: null};

    $scope.previewHtml = function() {
      $scope.previewDialog(partialUrl('dialog/previewHtml.html'));
    };
    $scope.previewText = function() {
      $scope.previewDialog(partialUrl('dialog/previewText.html'));
    };
    $scope.previewFull = function() {
      $scope.previewDialog(partialUrl('dialog/previewFull.html'));
    };
    // Open a dialog with a preview of the current mailing
    // @param template string URL of the template to use in the preview dialog
    $scope.previewDialog = function(template) {
      CRM.status(ts('Previewing'));
      crmMailingMgr
        .preview($scope.mailing)
        .then(function(content){
          var options = {
            autoOpen: false,
            modal: true,
            title: ts('Subject: %1', {
              1: content.subject
            }),
          };
          dialogService.open('previewDialog', template, content, options);
        });
    };
    $scope.sendTestToContact = function() {
      CRM.alert('Send test to contact, ' + $scope.testContact.email);
    };
    $scope.sendTestToGroup = function() {
      CRM.alert('Send test to group, ' + $scope.testGroup.gid);
    };
  });

  // Controller for the "Preview Mailing" dialog
  // Note: Expects $scope.model to be an object with properties:
  //   - "subject"
  //   - "body_html"
  //   - "body_text"
  crmMailing2.controller('PreviewMailingDialogCtrl', function ($scope, crmMailingMgr) {
    $scope.ts = CRM.ts('CiviMail');
  });

})(angular, CRM.$, CRM._);