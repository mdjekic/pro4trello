var TrelloPro = TrelloPro || {};

/**
 * Handles card name change event for a specific card
 *
 * @param jQuery $title
 * @param Boolean refreshData
 */
TrelloPro.cardNameChange = function ($title,refreshData) {
  var html = jQuery.trim($title.html());
  if (jQuery.trim($title.text()).length < 5) return;
  if (html.indexOf('<span class="tpro"></span>') > -1) return;

  // reference the card (parent)
  var $card = $title.parents('.list-card');

  // wrap HTML and remove card number
  var $htmlWrapper = jQuery('<div></div>').html(html);
  var $projectNumber = $htmlWrapper.find('.card-short-id');
  // if($projectNumber.length == 0) {
  //   //var cardNumber = $title.attr('href').split('/')[3].split('-')[0];
  //   // var cardNumber = 't';
  //   // $projectNumber = jQuery('<span class="card-short-id hide">#'+cardNumber+'</span>');
  // }
  // else {
  //   $projectNumber.detach();
  // }
  $projectNumber.detach();
  html = $htmlWrapper.html();

  // delay
  setTimeout(function () {
    var filterAttributes = [];
    var filterProject = jQuery('#tpro-filter').attr('data-project');
    var filterHide = false;

    {
      // groups/projects
      if (TrelloPro.settings['parse-projects']) {
        for(var i in TrelloPro.config.regex.tags) {
          html = html.replace(TrelloPro.config.regex.tags[i], function (match, capture) {
            var project = TrelloPro.config.renderers.tags(capture);

            // check filter
            if(filterProject != "" && filterProject != TrelloPro.renderAttrName(project)) filterHide = true;

            filterAttributes.push('tpro-project-' + TrelloPro.renderAttrName(project));
            return '<span class="tpro-project">' + project + '</span>';
          });
        }
      }

      // labels/tags
      if (TrelloPro.settings['parse-labels']) {
        html = html.replace(TrelloPro.config.regex.labels, function (match, capture) {
          var label = TrelloPro.config.renderers.labels(capture);
          filterAttributes.push('tpro-label-' + TrelloPro.renderAttrName(label));
          return '<div class="badge tpro-tag tpro-label">' + TrelloPro.config.symbols.label + ' ' + label + '</div>';
        });
      }

      // time entries
      if (TrelloPro.settings['parse-time-entries']) {
        html = html.replace(TrelloPro.config.regex.time_entries, function (match, capture) {
          return '<div class="badge tpro-tag tpro-time-entry">' + TrelloPro.config.symbols.time_entry + ' ' + TrelloPro.config.renderers.time_entries(capture) + '</div>';
        });
      }

      // parse-points
      if (TrelloPro.settings['parse-points']) {
        html = html.replace(TrelloPro.config.regex.points, function (match, capture) {
          return '<div class="badge tpro-tag tpro-point">' + TrelloPro.config.symbols.point + ' ' + TrelloPro.config.renderers.points(capture) + '</div>';
        });
      }

      // priority marks
      if (TrelloPro.settings['parse-priority-marks']) {
        var priorityCount = (html.match(/\!/g) || []).length;
        if(priorityCount > 0) {
          var priority = 'critical';
          switch(priorityCount) {
            case 1: priority = 'medium'; break;
            case 2: priority = 'high'; break;
          }
          filterAttributes.push('tpro-priority-'+priority);
          html = html.replace(/\!/g,'') + '<span class="badge tpro-tag tpro-priority"><i class="fa fa-exclamation-triangle tpro-priority ' + priority + '" aria-hidden="true"></i></span>';
        }
        else {
          // normal priority
          filterAttributes.push('tpro-priority-normal');
        }
      }

      // wrap HTML
      $htmlWrapper = jQuery('<div></div>').html(html);

      // add control span and re-introduce project number
      $htmlWrapper.prepend($projectNumber);
      $htmlWrapper.prepend('<span class="tpro"></span>');

      // get tags
      var tags = [];
      $htmlWrapper.find('.tpro-tag').each(function () {
        tags.push(jQuery(this));
      });

      // handle tags
      $card.find('.tpro-tag').remove();
      for (var i in tags) {
        if(tags[i].hasClass('tpro-priority')) {
          $card.find('.badges').prepend(tags[i]);
          continue;
        }
        $card.find('.badges').append(tags[i]);
      }

      // handle priority
      var $priority = $htmlWrapper.find('.tpro-priority');
      if($priority.length != 0) $priority.detach().appendTo($htmlWrapper);

      // apply filterAttributes
      $card.removeClass (function (index, css) {
        return (css.match (/(^|\s)tpro-\S+/g) || []).join(' ');
      });
      for(var i in filterAttributes) $card.addClass(filterAttributes[i]);
    }

    // handle title & refresh data
    $title.html($htmlWrapper.html());
    if(filterHide) $title.parents('.list-card').addClass('tpro-filter-hide');
    if(refreshData) TrelloPro.refreshData();
  })
}

/**
 * Loads current settings in the settings pane
 */
TrelloPro.loadSettingsPane = function () {
  for (var key in TrelloPro.settings) {
    // try checkbox
    var checkbox = TrelloPro.$settingsPane.find('input[type="checkbox"][name="' + key + '"]');
    if (checkbox.length != 0) {
      if (TrelloPro.settings[key]) {
        checkbox.attr('checked', true);
        checkbox.parents('.checklist-item').addClass('checklist-item-state-complete');
      }
      else {
        checkbox.removeAttr('checked');
        checkbox.parents('.checklist-item').removeClass('checklist-item-state-complete');
      }
      continue;
    }
    // try textarea
    var textarea = TrelloPro.$settingsPane.find('textarea[name="' + key + '"]');
    if (textarea.length != 0) {
      textarea.val(TrelloPro.settings[key]);
      continue;
    }
    // try radio
    var radio = TrelloPro.$settingsPane.find('input[type="radio"][name="' + key + '"][value="' + TrelloPro.settings[key] + '"]');
    if(radio.length != 0) {
      radio.attr('checked',true);
      continue;
    }
  }
}

/**
 * Builds the settings pane
 */
TrelloPro.buildSettingsPane = function () {
    // load settings HTML
    TrelloPro.$settingsPane = jQuery('<div class="tpro-settings-wrapper" style="display:none"></div>');
    TrelloPro.$settingsPane.load(chrome.extension.getURL("tmpl/settings.html"), function () {
        // determine root paths
        var imgRoot = chrome.extension.getURL('img');
        var docsRoot = chrome.extension.getURL('docs');

        // handle image sources
        TrelloPro.$settingsPane.find('img').each(function(){
          var $img = jQuery(this);
          $img.attr('src',$img.attr('src').replace('{$PATH}',imgRoot));
        });

        // handle docs links
        TrelloPro.$settingsPane.find('a.docsLink').each(function(){
          var $link = jQuery(this);
          $link.attr('href',$link.attr('href').replace('{$PATH}',docsRoot));
        });

        // attach tabs behaviur
        TrelloPro.$settingsPane.find('ul.tpro-settings-tabs li').click(function(){
          var $tab = $(this);

          TrelloPro.$settingsPane.find('ul.tpro-settings-tabs li').removeClass('current');
          TrelloPro.$settingsPane.find('.tpro-settings-section').removeClass('current');

          $tab.addClass('current');
          $("#"+$tab.attr('data-tab')).addClass('current');
        });

        // attach close button behaviour
        TrelloPro.$settingsPane.find('.tpro-settings-close').on('click', function () {
          TrelloPro.$settingsPane.fadeOut(150);
          jQuery('#board').show();
        });

        // attach save button behaviour
        TrelloPro.$settingsPane.find('.tpro-settings-save').on('click', function () {
          // handle checkboxes
          TrelloPro.$settingsPane.find('input[type="checkbox"]').each(function () {
            var checkbox = jQuery(this);
            TrelloPro.settings[checkbox.attr('name')] = checkbox.prop('checked');
          });
          // handle text area inputs
          TrelloPro.$settingsPane.find('textarea').each(function () {
            var textarea = jQuery(this);
            TrelloPro.settings[textarea.attr('name')] = textarea.val();
          });
          // handle select/radio buttons
          TrelloPro.$settingsPane.find('.tpro-settings-radio-group').each(function () {
            let radio = jQuery(this).find('input').filter(':checked');
            TrelloPro.settings[radio.attr('name')] = radio.val();
          });
          // update settings
          var settings = {};
          settings[TrelloPro.boardId] = TrelloPro.settings;
          chrome.storage.sync.set(settings, function () {
            window.location.reload();
          });
        });

        // attach checkbox item behavior
        TrelloPro.$settingsPane.find('.checklist-item-checkbox').on('click', function () {
          var item = jQuery(this).parents('.checklist-item');
          item.toggleClass('checklist-item-state-complete');
          if (item.hasClass('checklist-item-state-complete')) item.find('input[type="checkbox"]').attr('checked', 'checked');
          else item.find('input[type="checkbox"]').removeAttr('checked');
        });

        // attach version links behaviour
        TrelloPro.$settingsPane.find('a.tpro-version-link').on('click',function() {
          var version = jQuery(this).data('version');
          window.open(chrome.extension.getURL('/docs/trello-pro-updated-to-'+version+'.html'), '_blank');
          return false;
        });

        TrelloPro.$settingsPane.appendTo(jQuery('.board-canvas'));
      });
}

/**
 * Builds the TrelloPro menu
 */
TrelloPro.buildMenu = function () {
  var $button = jQuery('<a id="tpro-filter-trigger" class="board-header-btn calendar-btn" href="#"><span class="icon-sm icon-board board-header-btn-icon"></span><span class="board-header-btn-text u-text-underline">Pro4Trello</span></a>');
  $button.on('click', function () {
    if (TrelloPro.$settingsPane.is(':visible')) {
      TrelloPro.$settingsPane.fadeOut(150);
      jQuery('#board').show();
    }
    else {
      TrelloPro.loadSettingsPane();
      jQuery('#board').hide();
      TrelloPro.$settingsPane.fadeIn(150);
    }
  });
  setTimeout(function(){
    $button.prependTo(jQuery('.board-header-btns.mod-right'));
  },500);
}

/**
 * Builds the Project Filter
 */
TrelloPro.buildProjectFilter = function () {
  // create menu item
  var $menuItem = jQuery('<a class="board-header-btn" href="#"></a>');
  var $filter = jQuery('<span id="tpro-filter" data-project="" class="board-header-btn-text u-text-underline">All</span>');
  $menuItem.append('<span class="board-header-btn-icon icon-sm icon-filter"></span>');
  $menuItem.append(jQuery('<span class="board-header-btn-text"><span>Show: </span></span>').append($filter));

  // add behaviour
  $menuItem.on('click',function(e){
    var $popup = jQuery('#tpro-filter-popup');
    var $this = jQuery(this);
    if($popup.is(':visible')) { $popup.hide(); }
    else {
      // render project data
      var $list = $popup.find('ul.pop-over-list').html("");
      var selected = jQuery('#tpro-filter').attr('data-project');
      for(project of TrelloPro.projects) {
        let $a = jQuery(
          '<a class="js-select light-hover" data-project="'+project.key+'" href="#">'
            +project.value+' <span>('+project.cardCount+')</span>'
          +'</a>'
        );
        if(project.key == selected) $a.addClass('disabled');
        $list.append(jQuery('<li></li>').append($a));
      }
      $list.prepend('<li><a class="js-select light-hover" data-project="" href="#">All</a></li>'); // default "all"

      // attach filter behaviour
      $list.find('li a').on('click',function(evt){
        var $this = jQuery(this);

        $filter.attr('data-project',$this.data().project);
        $filter.text($this.text());
        jQuery('.list-card').removeClass('tpro-filter-hide');
        if($this.data().project != "") {
          jQuery('.list-card').not('.tpro-project-'+$this.data().project).addClass('tpro-filter-hide');
        }
        $popup.hide();

        evt.preventDefault();
        return false;
      });

      // show popup
      $popup.css({
        top: $this.position().top + $this.offset().top + $this.outerHeight(true) + 6,
        left: $this.offset().left
      }).show();
    }

    e.preventDefault();
    return false;
  });

  // create filter popup
  $filterPopup = jQuery('<div id="tpro-filter-popup"></div>');
  $filterPopup.append(
    '<div class="pop-over-header js-pop-over-header">'
      +'<span class="pop-over-header-title">Filter Cards</span>'
      +'<a href="#" class="pop-over-header-close-btn icon-sm icon-close"></a>'
    +'</div>'
  );
  $filterPopup.append(
    '<div><div class="pop-over-content js-pop-over-content u-fancy-scrollbar js-tab-parent" style="max-height: 673px;">'
      +'<div>'
        +'<ul class="pop-over-list">'
          +'<li><a class="js-select light-hover" href="#">All</a></li>'
        +'</ul>'
      +'</div>'
    +'</div></div>'
  );
  $filterPopup.find('a.pop-over-header-close-btn').on('click',function(e){
    $filterPopup.hide();
    e.preventDefault();
    return false;
  });

  jQuery('.board-header-btns.mod-left').append($menuItem);
  jQuery('body').append($filterPopup);
}

/**
 * Builds the Labels Filter
 */
TrelloPro.buildLabelsFilter = function () {
  var $menuItem = jQuery('<a class="board-header-btn" href="#"></a>');
  $menuItem.append('<span class="board-header-btn-icon icon-sm icon-label"></span>');
  $menuItem.append('<span class="board-header-btn-text">Tags: <span style="text-decoration: underline">All</span></span>');

    // TODO: implement

    jQuery('.board-header-btns.mod-left').append($menuItem);
  }

/**
 * Builds stats for a list
 *
 * @param {jQuery} $list
 * @param {Object} list
 */
TrelloPro.buildListStats = function($list,list) {
  // init and clear stats
  let $stats = $list.parent().find('.tpro-list-stats');
  if($stats.length == 0) {
    $stats = jQuery('<div class="tpro-list-stats"></div>');
    $stats.insertBefore($list);
  } else $stats.html('');

  // card count
  $stats.prepend(
    '<span class="tpro-stat count" title="Total cards">'
      +'<i class="fa fa-hashtag" aria-hidden="true"></i> '
      +list.totalCards
    +'</span>'
  );

  // tasks count
  $stats.prepend(
    '<span class="tpro-stat checklist" title="Checklist Tasks">'
      +'<i class="fa fa-check-square-o" aria-hidden="true"></i> '
      +list.completedTasks + '/' + list.totalTasks
    +'</span>');

  // points
  if(TrelloPro.settings['parse-points']) {
    $stats.prepend('<span class="tpro-stat points" title="Total points"><i class="fa fa-star" aria-hidden="true"></i> ' + list.totalPoints + '</span>');
  }
}

/**
 * Refreshes data for the current board
 */
TrelloPro.refreshData = function() {
    // just a sorting function
    var sorter = function(a,b) { return a.key.localeCompare(b.key); }

    // get all lists
    var lists = [];
    jQuery('.list').each(function(){
      let $this = jQuery(this);
      let list = {};

      // set basics
      list.title = $this.find('textarea.list-header-name').val();
      list.totalCards = parseInt($this.find('.list-header-num-cards').text());

      // count points
      list.totalPoints = 0;
      $this.find('.tpro-point').each(function(){
          let matches = jQuery.trim(jQuery(this).text()).match(/[.,\d]+/g);
          if(matches && matches[0]){
              list.totalPoints += parseFloat(matches[0].replace(",", "."));
          }
      });

      // count checklist tasks
      list.totalTasks = 0;
      list.completedTasks = 0;
      $this.find('.js-badges .icon-checklist').each(function(){
        let stats = jQuery(this).next('.badge-text').text().split('/');
        list.completedTasks += parseInt(stats[0]);
        list.totalTasks += parseInt(stats[1]);
      });

      // refresh stats
      if(TrelloPro.settings['show-list-stats']) TrelloPro.buildListStats($this,list);
      lists.push(list);
    });

    // get all projects
    var projects = [];
    var keys = [];
    jQuery('.tpro-project').each(function(){
      var project = jQuery.trim(jQuery(this).text());
      var key = TrelloPro.renderAttrName(project);
      var index = jQuery.inArray(key,keys);
      if(index > -1) {
        projects[index].cardCount++;
      }
      else {
        projects.push({ key: key, value: project, cardCount: 1 });
        keys.push(key);
      }
    });
    projects.sort(sorter);

    // get all labels
    var labels = [];
    keys = [];
    jQuery('.tpro-tag.tpro-label').each(function(){
      var label = jQuery.trim(jQuery(this).text().replace(TrelloPro.config.symbols.label,""));
      var key = TrelloPro.renderAttrName(label);
      var index = jQuery.inArray(key,keys);
      if(index > -1) {
        labels[index].cardCount++;
      }
      else {
        labels.push({ key: key, value: label, cardCount: 1 });
        keys.push(key);
      }
    });
    labels.sort(sorter);

    // TODO: consider current filters and the impact of the saved data on them

    TrelloPro.lists = lists;
    TrelloPro.projects = projects;
    TrelloPro.labels = labels;
  }

/**
 * Prepares a given string name to be used as a HTML attribute
 *
 * @param string name
 * @return string
 */
TrelloPro.renderAttrName = function(name) {
  return name.toLowerCase().replace(/\(.+?\)/g, '').replace(/[^a-z0-9+]+/gi, '-');
}

/**
 * Injects or removes a CSS stylesheet based on settings
 *
 * @param string name
 */
TrelloPro.toggleCssInject = function(name) {
  if (TrelloPro.settings[name]) {
    let $inject = jQuery('<style id="tpro-'+name+'-css"></style>');
    $inject.load(chrome.extension.getURL('css/'+name+'.css'), function () {
      jQuery('body').append($inject);
    });
  } else jQuery('#tpro-'+name+'-css').remove();
}

/**
 * Loads everything
 */
TrelloPro.load = function () {
  // get board ID and title
  TrelloPro.boardId = window.location.href.split('/')[4];
  TrelloPro.boardTitle = jQuery.trim(jQuery('title').text());

  console.log("🃑 Pro for Trello loaded for board \""+TrelloPro.boardTitle+"\".");

  // introduce font awesome
  if(jQuery('#trello-pro-font-awesome').length == 0)
    jQuery('body').append('<link id="trello-pro-font-awesome" href="'+chrome.extension.getURL("lib/font-awesome/css/font-awesome.min.css")+'" rel="stylesheet">');

  // load settings
  TrelloPro.settings = TrelloPro.config.defaultSettings;
  chrome.storage.sync.get(TrelloPro.boardId, function (settings) {
    console.log("🃑 Pro for Trello sync completed.");
    if (settings[TrelloPro.boardId]) settings = settings[TrelloPro.boardId];

      // merge with defaults
      TrelloPro.settings = jQuery.extend({}, TrelloPro.settings, settings);

      // parsing on?
      if (
        TrelloPro.settings['parse-projects']
        || TrelloPro.settings['parse-labels']
        || TrelloPro.settings['parse-time-entries']
        || TrelloPro.settings['parse-priority-marks']
        || TrelloPro.settings['parse-points']
      ) {
          // run card name processing on all cards
          jQuery('.list-card-title').each(function () {
              TrelloPro.cardNameChange(jQuery(this),false); // TODO: check if this "false" works here??
            });

          // // bind card name processing to name changes
          // jQuery('body').on('DOMSubtreeModified', '.list-card-title', function () {
          //     TrelloPro.cardNameChange(jQuery(this),true);
          // });

          // bind card name processing to list changes [delay: 2s]
          setTimeout(function(){
            jQuery('body').on('DOMNodeInserted', '.list-card', function () {
              $card = jQuery(this);
              if ($card.hasClass('placeholder')) return;
              if ($card.css('position') == 'absolute') return;
              TrelloPro.cardNameChange($card.find('.list-card-title'),true);
            });
          },2000);
        }

      // refresh data
      setTimeout(TrelloPro.refreshData,1000);

      TrelloPro.toggleCssInject('visible-card-numbers');
      TrelloPro.toggleCssInject('visible-labels');
      TrelloPro.toggleCssInject('hide-activity-entries');
      TrelloPro.toggleCssInject('full-screen-cards');
      TrelloPro.toggleCssInject('hide-add-list');
      TrelloPro.toggleCssInject('beautify-markdown');

      // label sizes
      if(TrelloPro.settings['visible-labels']) {
        jQuery('body').addClass('tpro-card-labels-size-'+TrelloPro.settings['labels-size']);
      } else {
        jQuery('body').removeClass('tpro-card-labels-size-'+TrelloPro.settings['labels-size']);
      }

      // list stats
      if(TrelloPro.settings['show-list-stats']) jQuery('body').addClass('tpro-show-list-stats');
      else jQuery('body').removeClass('tpro-show-list-stats');

      // custom background
      if (TrelloPro.settings['custom-background'] && TrelloPro.settings['custom-background-input'] != "") {
        var $customBackgroundStyle = jQuery('<style id="tpro-custom-background-css">body { background-image: url("'+TrelloPro.settings['custom-background-input']+'") !important }</style>');
        jQuery('body').append($customBackgroundStyle);
      }
      else {
        var $customBackgroundStyle = jQuery("#tpro-custom-background-css");
        while(true) {
          $customBackgroundStyle.remove();
          $customBackgroundStyle = jQuery("#tpro-custom-background-css");
          if($customBackgroundStyle.length == 0) break;
        }
      }

      // custom CSS
      if (TrelloPro.settings['custom-css'] && TrelloPro.settings['custom-css-input'] != "") {
        jQuery('body').append('<style id="tpro-custom-css">' + TrelloPro.settings['custom-css-input'] + '</style>');
      }
      else jQuery("#tpro-custom-css").remove();

      TrelloPro.buildSettingsPane();
      TrelloPro.buildMenu();
      if(TrelloPro.settings['parse-projects']) TrelloPro.buildProjectFilter();
      else jQuery('#tpro-filter-trigger').remove();
      //TrelloPro.buildLabelsFilter();
    });

  // bind ESC key
  jQuery(document).bind('keyup', function(e) {
  	if(e.keyCode === 27) {

      // filter popup
  		let $popup = jQuery('#tpro-filter-popup');
      if($popup.is(':visible')) {
        $popup.hide();
        return;
      }

      // settings
      let $settings = jQuery('.tpro-settings-wrapper');
      if($settings.is(':visible')) {
        $settings.find('.tpro-settings-close').click();
        return;
      }

  	}
  });

  // bind mouse click
  jQuery(document).bind('mouseup', function (e){

    // filter popup
    let $popup = jQuery('#tpro-filter-popup');
    if (!$popup.is(e.target) && $popup.has(e.target).length === 0) {
        $popup.hide();
        return;
    }

  });

  // trigger data refresh every 10 seconds
  (refresh = function() { TrelloPro.refreshData(); setTimeout(refresh,10000); })();
}

// catch title changes
jQuery('title').bind("DOMSubtreeModified",function(){
  var title = jQuery.trim(jQuery(this).text());
  var path = window.location.href.split('/');

  if(path[3] != 'b') return; // works for boards only, not cards
  if(title == TrelloPro.boardTitle) return;
  if(TrelloPro.boardId == path[4]) return;

  TrelloPro.load();
});

// init
TrelloPro.settings = {};
TrelloPro.projects = [];
TrelloPro.labels = [];

// start the magic (for boards only)
if(window.location.href.split('/')[3] == 'b') TrelloPro.load();

// // check if a card is opened directly
// if(window.location.href.split('/')[3] == 'c') {
//   chrome.storage.local.set({ 'tpro-redirect': window.location.href });
//   setTimeout(function(){
//     console.log(jQuery('.window-wrapper a.icon-close').get(0))
//     jQuery('.window-wrapper a.icon-close').click();
//   },2000) ;
// }
// else if(window.location.href.split('/')[3] == 'b') {
//   // check for redirect
//   chrome.storage.local.get('tpro-redirect',function(result){
//     if(result['tpro-redirect'] && result['tpro-redirect'] != null) {
//       chrome.storage.local.set({ 'tpro-redirect': null, 'tpro-board-id': window.location.href.split('/')[4] });
//       history.pushState(null, null, result['tpro-redirect']);
//     }
//     else TrelloPro.load();
//   });
// }
