// -----------------------------------------------------------------------------
// Init
// -----------------------------------------------------------------------------

var TrelloPro = TrelloPro || {};

TrelloPro.boardId = null;
TrelloPro.boardTitle = null;

TrelloPro.settings = {};
TrelloPro.settingsOverride = false;
TrelloPro.autoHideFooter = false;

TrelloPro.data = {
	lists: [],
	priorities: [],
	projects: [],
	labels: [],
	hashtags: []
};
TrelloPro.lists = [];

TrelloPro.$dynamicStyles = null;

TrelloPro.loaded = false;
TrelloPro.refreshing = false;

// -----------------------------------------------------------------------------
// Utility
// -----------------------------------------------------------------------------

/// https://stackoverflow.com/questions/10073699/pad-a-number-with-leading-zeros-in-javascript
/**
 * Sums 2 time entries
 *
 * @param {string} startTime
 * @param {string} endTime
 * @return {string}
 */
sumTimeEntriesPad = function (n, width, z) {
	z = z || '0';
	n = n + '';
	return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}


/**
 * Sums 2 time entries
 *
 * @param {string} startTime
 * @param {string} endTime
 * @return {string}
 */
let sumTimeEntries = function(startTime, endTime) {
  let times = [0, 0];
  let max = times.length;

  startTime = (startTime || '').split(':');
  endTime = (endTime || '').split(':');

  for (let i = 0; i < max; i++) {
    startTime[i] = isNaN(parseInt(startTime[i])) ? 0 : parseInt(startTime[i]);
    endTime[i] = isNaN(parseInt(endTime[i])) ? 0 : parseInt(endTime[i]);
		times[i] = startTime[i] + endTime[i];
  }

  let hours = times[0];
  let minutes = times[1];

  if (minutes >= 60) {
    let h = (minutes / 60) << 0;
    hours += h;
    minutes -= 60 * h;
  }
  
  let hours_str = (hours >= 100)? ''+hours : sumTimeEntriesPad(hours, 2);  
  let minutes_str = (minutes >= 100)? ''+minutes : sumTimeEntriesPad(minutes, 2);

  return hours_str + ':' + minutes_str;
}


/**
 * Sums 2 number/prices
 *
 * @param {string} price1
 * @param {string} price2
 * @return {string}
 */
let sumPrices = function (price1, price2) {
	let p1 = parseFloat(price1);
	let p2 = parseFloat(price2);
	let price = (p1 + p2).toFixed(2);
	return price.toString();
}

/**
 * Prepares a given string name to be used as a HTML attribute
 *
 * @param {string} name
 * @return {string}
 */
let renderAttrName = function(name) {
  return name.toLowerCase()	
	.replace(/[!@#$%^&*(),.?":{}|<> ]/gi, '-')
	.replace(/(-)(?=.*\1)/g, "");
}

/**
 * Injects or removes a CSS stylesheet based on settings
 *
 * @param {string} name
 */
let toggleCssInject = function(name) {
  if (TrelloPro.settings[name]) {
    let $inject = jQuery('<style id="tpro-'+name+'-css"></style>');
    $inject.load(chrome.runtime.getURL('css/'+name+'.css'), function () {
      jQuery('body').append($inject);
    });
  } else jQuery('#tpro-'+name+'-css').remove();
}

/**
 * Log to the console
 *
 * @param {object} object
 */
let log = function(object) {
	return;
	console.log(object);
};

/**
 * Handles card name change event for a specific card
 *
 * @param {jQuery} $title
 * @param {Boolean} refreshData
 * @return {Promise}
 */
let processCardTitleChange = function ($title,refreshData) {
  return new Promise((resolve,reject) => {
		let html = jQuery.trim($title.html());
	  if (jQuery.trim($title.text()).length < 5) { resolve(); return; }
	  if (html.indexOf('<span class="tpro"></span>') > -1) { resolve(); return; }

	  // reference the card (parent)
	  let $card = $title.parents('.list-card');

	  // wrap HTML and remove card number
	  let $htmlWrapper = jQuery('<div></div>').html(html);
	  let $projectNumber = $htmlWrapper.find('.card-short-id');
	  // if($projectNumber.length == 0) {
	  //   //var cardNumber = $title.attr('href').split('/')[3].split('-')[0];
	  //   // let cardNumber = 't';
	  //   // $projectNumber = jQuery('<span class="card-short-id hide">#'+cardNumber+'</span>');
	  // }
	  // else {
	  //   $projectNumber.detach();
	  // }
	  $projectNumber.detach();
	  html = $htmlWrapper.html();

	  // delay
	  setTimeout(function () {
	    let filterAttributes = [];

	    // groups/projects
	    if (TrelloPro.settings['parse-projects']) {
	      for(let i in TrelloPro.config.regex.tags) {
	        html = html.replace(TrelloPro.config.regex.tags[i], function (match, capture) {
	          let project = TrelloPro.config.renderers.tags(capture);
	          filterAttributes.push('tpro-project-' + renderAttrName(project));
	          return '<span class="tpro-project">' + project + '</span>';
	        });
	      }
				// no project/group
				if(filterAttributes.length == 0) {
					filterAttributes.push('tpro-project-noproject');
				}
	    }

	    // labels/tags
	    if (TrelloPro.settings['parse-labels']) {
	      html = html.replace(TrelloPro.config.regex.labels, function (match, capture) {
	        let label = TrelloPro.config.renderers.labels(capture);
	        filterAttributes.push('tpro-label-' + renderAttrName(label));
	        return '<div class="badge tpro-tag tpro-label">' + TrelloPro.config.symbols.label + ' ' + label + '</div>';
	      });
	    }

			// hashtags
	    if (TrelloPro.settings['parse-hashtags']) {
				html = html.replace(TrelloPro.config.regex.hashtags, function (match, capture) {
					let hashtag = jQuery.trim(TrelloPro.config.renderers.hashtags(capture).replace('#',''));
					filterAttributes.push('tpro-hashtag-' + renderAttrName(hashtag));
					return '<span class="tpro-hashtag"> #' + hashtag + '</span>';
				});
	    }

	    // time entries
	    if (TrelloPro.settings['parse-time-entries']) {
	      html = html.replace(TrelloPro.config.regex.time_entries, function (match, capture) {
	        return '<div class="badge tpro-tag tpro-time-entry">' + TrelloPro.config.symbols.time_entry + ' ' + TrelloPro.config.renderers.time_entries(capture) + '</div>';
	      });
	    }

	    // points
	    if (TrelloPro.settings['parse-points']) {
	      html = html.replace(TrelloPro.config.regex.points, function (match, capture) {
	        return '<div class="badge tpro-tag tpro-point">' + TrelloPro.config.symbols.point + ' ' + TrelloPro.config.renderers.points(capture) + '</div>';
	      });
	    }

	    // prices 
	    if (TrelloPro.settings['parse-price-entries']) {
		  html = html.replace(TrelloPro.config.regex.price_entries, function (match, capture) {
		    return '<div class="badge tpro-tag tpro-price-entry">' + TrelloPro.config.symbols.price_entry + ' ' + TrelloPro.config.renderers.price_entries(capture) + '</div>';
		  });
		}

	    // priority marks
	    if (TrelloPro.settings['parse-priority-marks']) {
	      let priorityCount = (html.match(/\!/g) || []).length;
	      if(priorityCount > 0) {
	        let priority = 'low';
	        switch(priorityCount) {
	          case 2: priority = 'medium'; break;
	          case 3: priority = 'high'; break;
	        }
	        filterAttributes.push('tpro-priority-'+priority);
	        html = html.replace(/\!/g,'') + '<span class="badge tpro-tag tpro-priority"><i class="fa fa-exclamation-triangle tpro-priority ' + priority + '" aria-hidden="true"></i></span>';
	      }
	      else {
	        filterAttributes.push('tpro-priority-no');
	      }
	    }

		// markup
		if (TrelloPro.settings['parse-markup']) {
			html = html
				.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
			.replace(/\*(.+?)\*/g, '<em>$1</em>')
				.replace(/_(.+?)_/g, '<em>$1</em>')
			.replace(/~~(.+?)~~/g, '<strike>$1</strike>')
			.replace(/\`(.+?)\`/g, '<code>$1</code>');
	    }

	    // wrap HTML
	    $htmlWrapper = jQuery('<div></div>').html(html);

	    // add control span and re-introduce project number
	    $htmlWrapper.prepend($projectNumber);
	    $htmlWrapper.prepend('<span class="tpro"></span>');

	    // get tags
	    let tags = [];
	    $htmlWrapper.find('.tpro-tag').each(function () {
	      tags.push(jQuery(this));
	    });

	    // handle tags
	    $card.find('.tpro-tag').remove();
	    for (let i in tags) {
	      if(tags[i].hasClass('tpro-priority')) {
	        $card.find('.badges').prepend(tags[i]);
	        continue;
	      }
	      $card.find('.badges').append(tags[i]);
	    }

	    // handle priority
	    let $priority = $htmlWrapper.find('.tpro-priority');
	    if($priority.length != 0) $priority.detach().appendTo($htmlWrapper);

	    // apply filterAttributes
	    $card.removeClass (function (index, css) {
	      return (css.match (/(^|\s)tpro-\S+/g) || []).join(' ');
	    });
	    for(let i in filterAttributes) $card.addClass(filterAttributes[i]);

	    // handle title & refresh data
	    $title.html($htmlWrapper.html());
			if(refreshData) {
				refreshData('card title update');
				refreshListsAndStats();
			}

			resolve();
	  });
	});
}

/**
 * Handles list name change event for a specific list
 *
 * @param {jQuery} $list
 */
let processListTitleChange = function($list) {
	let oldId = $list.data('tpro-list');
	refreshListsAndStats();
	let newId = $list.data('tpro-list');

	// update enchancements
	if(TrelloPro.settings.listEnchancements && TrelloPro.settings.listEnchancements[oldId]) {
		TrelloPro.settings.listEnchancements[newId] = TrelloPro.settings.listEnchancements[oldId];
		delete TrelloPro.settings.listEnchancements[oldId];
	}

	// update filters
	if(TrelloPro.settings.filters.lists) {
		let index = TrelloPro.settings.filters.lists.indexOf(oldId);
		if(index > -1) {
			TrelloPro.settings.filters.lists[index] = newId;
		}
	}

	// remove old class
	$list.removeClass('tpro-list-'+oldId);
	rebuildDynamicStyles();
}

/**
 * Rebuilds dynamic styles based on input
 */
let rebuildDynamicStyles = function() {
	log('rebuilding dynamic styles...');

  let css = '';

	if(TrelloPro.loaded) {

		// build priority filters
		if(TrelloPro.settings['parse-priority-marks'] && TrelloPro.settings.filters.priority) {
			css += '#tpro-header-button-priority { background-color: #2c3e50; } ';
			css += '.list-card:not(.js-composer):not(.tpro-priority-' + TrelloPro.settings.filters.priority + ') { display: none; } ';
		}

		// build project filters
		if(TrelloPro.settings['parse-projects'] && TrelloPro.settings.filters.project) {
			// apply only if project exists
			if(TrelloPro.data.projects.map(function(project){ return project.key; }).indexOf(TrelloPro.settings.filters.project) > -1) {
				css += '#tpro-header-button-projects { background-color: #2c3e50; } ';
				css += '.list-card:not(.js-composer):not(.tpro-project-' + TrelloPro.settings.filters.project + ') { display: none; } ';
			}
		}

		// build label filters
		if(TrelloPro.settings['parse-labels'] && TrelloPro.settings.filters.label) {
			// apply only if label exists
			if(TrelloPro.data.labels.map(function(label){ return label.key; }).indexOf(TrelloPro.settings.filters.label) > -1) {
				css += '#tpro-header-button-labels { background-color: #2c3e50; } ';
				css += '.list-card:not(.js-composer):not(.tpro-label-' + TrelloPro.settings.filters.label + ') { display: none; } ';
			}
		}

		// build hashtag filters
		if(TrelloPro.settings['parse-hashtags'] && TrelloPro.settings.filters.hashtag) {
			// apply only if hashtag exists
			if(TrelloPro.data.hashtags.map(function(hashtag){ return hashtag.key; }).indexOf(TrelloPro.settings.filters.hashtag) > -1) {
				css += '#tpro-header-button-hashtags { background-color: #2c3e50; } ';
				css += '.list-card:not(.js-composer):not(.tpro-hashtag-' + TrelloPro.settings.filters.hashtag + ') { display: none; } ';
			}
		}

		// build list filters
		if(TrelloPro.settings.filters.lists) {
			for(let list of TrelloPro.settings.filters.lists) {
				css += '.tpro-list-'+list+' { display:none !important; } ';
			}
			if(TrelloPro.settings.filters.lists.length > 0) {
				css += '#tpro-header-button-lists { background-color: #2c3e50; } ';
			}
		}

		// build list enchancements
		if(TrelloPro.settings.listEnchancements) {
			css += '.list-card { max-width: 100% !important; } ';
			for(let list in TrelloPro.settings.listEnchancements) {
				if(TrelloPro.settings.listEnchancements[list]['background']) {
					css += '.tpro-list-'+list+' .list { background-color: '+TrelloPro.settings.listEnchancements[list]['background']+' !important; } ';
					css += '.tpro-list-'+list+' .tpro-list-stats { background-color: '+TrelloPro.settings.listEnchancements[list]['background']+' !important; } ';
				}
				if(TrelloPro.settings.listEnchancements[list]['width']) {
					css += '.tpro-list-'+list+' { width: '+TrelloPro.settings.listEnchancements[list]['width']+' !important; } ';
				}
			}
		}
	}

  TrelloPro.$dynamicStyles.html(css);
}

/**
 * Attempts to store in sync storrage
 *
 * @param {string} key
 * @param {object} value
 */
let store = function(key, value) {
	let storrage = {};
  storrage[key] = value;
  chrome.storage.sync.set(storrage);
}

/**
 * Attempts to save current board settings
 */
let saveSettings = function() {
	log('saving board settings...');
	store(TrelloPro.boardId,TrelloPro.settings);
}

/**
 * Sets list enchancement in settings
 *
 * @param {string} list
 * @param {string} key
 * @param {string} value
 */
let setListEnchancement = function(list, key, value) {
	if(!TrelloPro.settings.listEnchancements) {
		TrelloPro.settings.listEnchancements = {};
	}
	if(!TrelloPro.settings.listEnchancements[list]) {
		TrelloPro.settings.listEnchancements[list] = {};
	}
	if(value !== "") {
		TrelloPro.settings.listEnchancements[list][key] = value;
	} else {
		delete TrelloPro.settings.listEnchancements[list][key];
	}
}

/**
 * Gets list enchancement from settings
 *
 * @param {string} list
 * @param {string} key
 */
let getListEnchancement = function(list, key) {
	if(TrelloPro.settings.listEnchancements && TrelloPro.settings.listEnchancements[list] && TrelloPro.settings.listEnchancements[list][key]) {
		return TrelloPro.settings.listEnchancements[list][key];
	}
	return false;
}

// -----------------------------------------------------------------------------
// Board Data
// -----------------------------------------------------------------------------

/**
 * Builds board data
 *
 * @return {object}
 */
let buildData = function() {
	// just a sorting function
  let sorter = function(a,b) { return a.key.localeCompare(b.key); }

	// form priorities
	let priorities = [
		{ key: 'no', value: 'No Priority', cardCount: jQuery('.tpro-priority-no').length },
		{ key: 'low', value: 'Low Priority', cardCount: jQuery('.tpro-priority-low').length },
		{ key: 'medium', value: 'Medium Priority', cardCount: jQuery('.tpro-priority-medium').length },
		{ key: 'high', value: 'High Priority', cardCount: jQuery('.tpro-priority-high').length }
	];

  // get all projects
	let projects = [];
	let keys = [];
	let $projects = jQuery('.tpro-project');
	for(let i=0; i<$projects.length; i++) {
		let project = jQuery.trim(jQuery($projects[i]).text());
		let key = renderAttrName(project);
		let index = jQuery.inArray(key,keys);
		if(index > -1) {
			projects[index].cardCount++;
		} else {
			projects.push({ key: key, value: project, cardCount: 1 });
			keys.push(key);
		}
	}
	projects.sort(sorter);

	// get special "no project" project
	let $noProject = jQuery('.tpro-project-noproject');
	projects.unshift({ key: 'noproject', value: 'Uncategorized', cardCount: $noProject.length });

  // get all labels
  let labels = [];
  keys = [];
  let $labels = jQuery('.tpro-tag.tpro-label');
  for(let i=0; i<$labels.length; i++) {
    let label = jQuery.trim(jQuery($labels[i]).text().replace(TrelloPro.config.symbols.label,""));
    let key = renderAttrName(label);
    let index = jQuery.inArray(key,keys);
    if(index > -1) {
      labels[index].cardCount++;
    }
    else {
      labels.push({ key: key, value: label, cardCount: 1 });
      keys.push(key);
    }
  }
  labels.sort(sorter);

	// get all hashtags
	let hashtags = [];
	keys = [];
  let $hashtags = jQuery('.tpro-hashtag');
  for(let i=0; i<$hashtags.length; i++) {
    let hashtag = jQuery.trim(jQuery($hashtags[i]).text().replace('#',''));
    let key = renderAttrName(hashtag);
    let index = jQuery.inArray(key,keys);
    if(index > -1) {
      hashtags[index].cardCount++;
    }
    else {
      hashtags.push({ key: key, value: hashtag, cardCount: 1 });
      keys.push(key);
    }
  }
  hashtags.sort(sorter);

	TrelloPro.data.priorities = priorities;
	TrelloPro.data.projects = projects;
	TrelloPro.data.labels = labels;
	TrelloPro.data.hashtags = hashtags;

	store('data_'+TrelloPro.boardId, TrelloPro.data);
}

/**
 * Refreshes data for the current board
 *
 * @param {string} msg
 * @param {function} callback
 */
let refreshData = function(msg, callback) {
	if(!TrelloPro.loaded) return;
	if(TrelloPro.refreshing) return;

	log('data refresh - ' + msg);
	TrelloPro.refreshing = true;
  buildData();
	TrelloPro.refreshing = false;

	if('undefined' !== typeof callback) callback();
}

/**
 * Refreshes list stats
 */
let refreshListsAndStats = function() {
	if(!TrelloPro.loaded) return;
	log('refreshing list stats...');

	// TODO get lists from API (?)

	// get all lists
  let lists = [];
  let $lists = jQuery('.list');
  for(let i=0; i<$lists.length; i++) {
    let $this = jQuery($lists[i]);
    let list = {};

		/**
		 * Filters visible cards only
		 */
		let visibleFilter = function() {
			// ignore filtered by project
			if(TrelloPro.settings.filters.project
				&& !jQuery(this).hasClass('tpro-project-' + TrelloPro.settings.filters.project)) return false;

			// ignore filtered by Trello
			return jQuery(this).height() > 20;
		};

    // set basics
    list.title = $this.find('textarea.list-header-name').val();
		list.id = renderAttrName(list.title);
		list.index = i;
    list.totalCards = parseInt($this.find('.list-header-num-cards').text());
		list.totalVisibleCards = $this.find('.list-card').filter(visibleFilter).length;

		// count points
    list.totalPoints = 0;
		list.totalVisiblePoints = 0;
    $this.find('.tpro-point').each(function(){
      list.totalPoints += parseFloat(jQuery.trim(jQuery(this).text()));
    });
		$this.find('.list-card').filter(visibleFilter).find('.tpro-point').each(function(){
      list.totalVisiblePoints += parseFloat(jQuery.trim(jQuery(this).text()));
    });

		// count time
    list.totalTime = '0:00';
		list.totalVisibleTime = '0:00';
    $this.find('.tpro-time-entry').each(function(){
			let t = jQuery.trim(jQuery(this).text());
			list.totalTime = sumTimeEntries(list.totalTime, t);
    });
		$this.find('.list-card').filter(visibleFilter).find('.tpro-time-entry').each(function(){
			let t = jQuery.trim(jQuery(this).text());
			list.totalVisibleTime = sumTimeEntries(list.totalVisibleTime, t);
    });

	// count price
    list.totalPrice = '0.00';
	list.totalVisiblePrice = '0.00';
	$this.find('.tpro-price-entry').each(function(){
		let t = jQuery.trim(jQuery(this).text());
		list.totalPrice = sumPrices(list.totalPrice, t);
	});
	$this.find('.list-card').filter(visibleFilter).find('.tpro-price-entry').each(function(){
		let t = jQuery.trim(jQuery(this).text());
		list.totalVisiblePrice = sumPrices(list.totalVisiblePrice, t);
	});
	

    // count checklist tasks
    list.totalTasks = 0;
    list.completedTasks = 0;
    $this.find('.js-badges .icon-checklist').each(function(){
      let stats = jQuery(this).next('.badge-text').text().split('/');
      list.completedTasks += parseInt(stats[0]);
      list.totalTasks += parseInt(stats[1]);
    });

		if(TrelloPro.settings['show-list-stats']) {
			buildListStats($this,list);
		}

		// attach ID
		$this.parent().addClass('tpro-list-'+list.id).data('tpro-list',list.id);

		// TODO merge w/ API lists
    lists.push(list);
  }

	TrelloPro.lists = lists;
	store('lists_'+TrelloPro.boardId, TrelloPro.lists);
	refreshListFilter();
}

/**
 * Refreshes list filter rendering
 */
let refreshListFilter = function() {
	let shown = TrelloPro.lists.length - (TrelloPro.settings.filters.lists ? TrelloPro.settings.filters.lists.length : 0);
	jQuery('#tpro-lists-filter').text(shown + '/' + TrelloPro.lists.length);
}

// -----------------------------------------------------------------------------
// Builders
// -----------------------------------------------------------------------------

/**
 * Loads current settings in the settings pane
 */
let loadSettingsPane = function () {
	log('loading board settings...');

	// check for board override
	if(TrelloPro.settingsOverride) {
		TrelloPro.$settingsPane.find('input[name="board-override"]')
			.attr('checked','checked')
			.parents('.switch').css('background','#2ecc71');
		TrelloPro.$settingsPane.find('.tpro-settings-container').show();
		TrelloPro.$settingsPane.find('.tpro-settings-info').hide();
	} else {
		TrelloPro.$settingsPane.find('input[name="board-override"]')
			.removeAttr('checked')
			.parents('.switch').css('background','#BDB9A6');
		TrelloPro.$settingsPane.find('.tpro-settings-container').hide();
		TrelloPro.$settingsPane.find('.tpro-settings-info').show();
	}

	// load settings
	TrelloPro.$boardSettingsIframe.attr('src',chrome.runtime.getURL('board.html')+'#b='+TrelloPro.boardId);
}

/**
 * Builds the settings pane
 */
let buildSettingsPane = function () {
		log('building settings pane...');

    // load settings HTML
    TrelloPro.$settingsPane = jQuery('<div class="tpro-settings-wrapper" style="display:none"></div>');
    TrelloPro.$settingsPane.load(chrome.runtime.getURL("tmpl/settings.html"), function () {
        // determine root paths
        let imgRoot = chrome.runtime.getURL('img');
        let root = chrome.runtime.getURL('');

        // handle image sources
        TrelloPro.$settingsPane.find('img').each(function(){
          let $img = jQuery(this);
          $img.attr('src',$img.attr('src').replace('{$PATH}',imgRoot));
        });

        // handle links source
        TrelloPro.$settingsPane.find('a').each(function(){
          let $a = jQuery(this);
          $a.attr('href',$a.attr('href').replace('{$PATH}',root));
        });

				// reference board settings iframe
				TrelloPro.$boardSettingsIframe = TrelloPro.$settingsPane.find('iframe#tpro-board-settings');

				// attach toggle behaviour
				TrelloPro.$settingsPane.find('input[name="board-override"]').on('change',function(){
					let $this = jQuery(this);
					if($this.is(':checked')) {
						$this.parents('.switch').css('background','#2ecc71');
						TrelloPro.$settingsPane.find('.tpro-settings-info').hide();
						TrelloPro.$settingsPane.find('.tpro-settings-container').slideDown();
					} else {
						$this.parents('.switch').css('background','#BDB9A6');
						TrelloPro.$settingsPane.find('.tpro-settings-container').slideUp();
						TrelloPro.$settingsPane.find('.tpro-settings-info').show();
					}
				});

        // attach close button behaviour
        TrelloPro.$settingsPane.find('.tpro-settings-close').on('click', function () {
					saveSettings();
          TrelloPro.$settingsPane.fadeOut(150);
					jQuery('#board').show();
					//TrelloPro.$footer.show();
        });

        // attach save button behaviour
        TrelloPro.$settingsPane.find('.tpro-settings-save').on('click', function () {
					// check for override
					if(!TrelloPro.$settingsPane.find('input[name="board-override"]').is(':checked')) {
						TrelloPro.settings = false;
						saveSettings();
					}

					window.location.reload();
        });

        TrelloPro.$settingsPane.appendTo(jQuery('.board-canvas'));
      });
}

/**
 * Loads the sharing pane
 */
let loadSharePane = function() {
	let $sharePane = jQuery('<div id="tpro-share-container"></div>');

	$sharePane.load(chrome.runtime.getURL("tmpl/share.html"), function () {
		// determine root paths
		let imgRoot = chrome.runtime.getURL('img');
		let root = chrome.runtime.getURL('');

		// handle image sources
		$sharePane.find('img').each(function(){
			let $img = jQuery(this);
			$img.attr('src',$img.attr('src').replace('{$PATH}',imgRoot));
		});

		// handle links source
		$sharePane.find('a').each(function(){
			let $a = jQuery(this);
			$a.attr('href',$a.attr('href').replace('{$PATH}',root));
		});

		$sharePane.on('click', function(){
			$sharePane.remove();
		});

		$sharePane.appendTo(jQuery('body'));
	});
}

/**
 * Builds the TrelloPro footsser
 */
let buildFooter = function() {
	log('building footer...');

	TrelloPro.$footer = jQuery('<div id="tpro-footer" class="u-clearfix"><div class="board-header-btns mod-left"></div><div class="board-header-btns mod-right"></div></div>');
	TrelloPro.$footer.appendTo(jQuery('.board-main-content'));
	if(TrelloPro.autoHideFooter) {
		TrelloPro.$footer.hide();
	}
}

/**
 * Builds the TrelloPro menu
 */
let buildMenu = function () {
	log('building menu button...');

	// prepare popup
	let $popup = buildPopup('tpro-menu-popup','Pro4Trello Menu');
	let $list = $popup.find('.pop-over-list').html('');
	let $toggleFooter = jQuery('<input id="tpro-toggle-hide-footer" type="checkbox" value="1" />')
	$list.append('<li><a class="js-select light-hover" href="#" data-action="settings"><i class="fa fa-cog" style="color: #0984e3; float:right; padding-top: 3px;"></i>Board Settings</a></li>');
	$list.append('<li><a class="js-select light-hover" href="#" data-action="global-settings"><i class="fa fa-cogs" style="color: #e17055; float:right; padding-top: 3px;"></i>Global Settings</a></li>');
	$list.append('<li><a class="js-select light-hover" href="#" data-action="help-videos"><i class="fa fa-video-camera" style="color: #e84393; float:right; padding-top: 3px;"></i>Help Videos</a></li>');
	$list.append('<li><hr /></li>');
	$list.append('<li><a class="js-select light-hover" href="#" data-action="about"><i class="fa fa-question-circle" style="color: #2d3436; float:right; padding-top: 3px;"></i>About</a></li>');
	$list.append('<li><a class="js-select light-hover" href="#" data-action="review"><i class="fa fa-thumbs-up" style="color: #006266; float:right; padding-top: 3px;"></i>Review Extension</a></li>');
	$list.append('<li><a class="js-select light-hover" href="#" data-action="support"><i class="fa fa-book" style="color: #6c5ce7; float:right; padding-top: 3px;"></i>Get Support</a></li>');
	$list.append('<li><hr /></li>');
	$list.append('<li><a class="js-select light-hover" href="#" data-action="share"><i class="fa fa-heart" style="color: #d63031; float:right; padding-top: 3px;"></i>Share the Love</a></li>');
	$list.append('<li><a class="js-select light-hover" href="#" data-action="donate" style="background-color: #ffeaa7"><i class="fa fa-beer" style="color: #F79F1F; float:right; padding-top: 3px;"></i>Donate to Author</a></li>');
	$popup.append('<hr />');
	$popup.append(jQuery('<div style="text-align:center"></div>').append(jQuery('<label for="tpro-toggle-hide-footer">Auto-hide footer</label>').prepend($toggleFooter)));

	let $menuButton = jQuery('<a id="tpro-menu-button" class="board-header-btn calendar-btn" href="#"><span class="icon-sm icon-board board-header-btn-icon"></span><span class="board-header-btn-text u-text-underline">Pro4Trello</span></a>');
	$menuButton.on('click', function(e) {
		let $this = jQuery(this);
    if($popup.is(':visible')) { $popup.hide(); }
    else {
			$popup.css({
        top: $this.position().top + $this.offset().top + $this.outerHeight(true) - $popup.height(),
        right: 10
			}).show();
		}
    e.preventDefault();
    return false;
	});

	// menu items behavior
	$list.find('li a').on('click',function(evt){
		switch(jQuery(this).data('action')) {
			case 'settings':
				loadSettingsPane();
				TrelloPro.$settingsPane.fadeIn(150);
				jQuery('#board').hide();
				TrelloPro.$footer.hide();
				break;
			case 'global-settings':
				window.open(chrome.runtime.getURL('options.html'), '_blank');
				break;
			case 'help-videos':
				window.open('https://apptorium.net/pro-for-trello/helper-videos', '_blank');
				break;
			case 'about':
				window.open(chrome.runtime.getURL('docs/about.html'), '_blank');
				break;
			case 'review':
				window.open('https://chrome.google.com/webstore/detail/pro-for-trello-free-trell/hcjkfaengbcfeckhjgjdldmhjpoglecc/reviews', '_blank');
				break;
			case 'support':
				window.open('https://chrome.google.com/webstore/detail/pro-for-trello-free-trell/hcjkfaengbcfeckhjgjdldmhjpoglecc/support', '_blank');
				break;
			case 'share':
				loadSharePane();
				break;
			case 'donate':
				window.open(chrome.runtime.getURL('docs/donate.html'), '_blank');
				break;
		}

		$popup.hide();
		evt.preventDefault();
		return false;
	});

	// toggle footer auto-hide toggle behavior
	if(TrelloPro.autoHideFooter) {
		$toggleFooter.attr('checked',true);
	}
	$toggleFooter.on('change',function(e){
		TrelloPro.autoHideFooter = $toggleFooter.is(':checked');
		if(!TrelloPro.autoHideFooter) {
			TrelloPro.$footer.show();
		}
		store('autohide',TrelloPro.autoHideFooter);
	});

	$menuButton.appendTo(TrelloPro.$footer.find('.board-header-btns.mod-right'));
}

/**
 * Builds a popup
 *
 * @param {string} id
 * @param {string} title
 */
let buildPopup = function(id, title){
  let $popup = jQuery('<div id="'+id+'" class="tpro-popup"></div>');
  $popup.append(
    '<div class="pop-over-header js-pop-over-header">'
      +'<span class="pop-over-header-title">'+title+'</span>'
      +'<a href="#" class="pop-over-header-close-btn icon-sm icon-close"></a>'
    +'</div>'
  );
  $popup.append(
    '<div><div class="pop-over-content js-pop-over-content u-fancy-scrollbar js-tab-parent" style="max-height: 673px;">'
      +'<div>'
        +'<ul class="pop-over-list">'
          +'<li><a class="js-select light-hover" href="#">None</a></li>'
        +'</ul>'
      +'</div>'
    +'</div></div>'
  );
  $popup.find('a.pop-over-header-close-btn').on('click',function(e){
    $popup.hide();
    e.preventDefault();
    return false;
	});

	return $popup.appendTo(jQuery('body'));
}

/**
 * Builds the Priority Filter
 */
let buildPriorityFilter = function () {
	if(!TrelloPro.settings['parse-priority-marks']) return;
	log('building priority filter...');

  // create menu item
  let $menuItem = jQuery('<a id="tpro-header-button-priority" class="board-header-btn" href="#"></a>');

  // try to apply pre-loaded filter
  let $filter = jQuery('<span id="tpro-filter-priority" data-priority="" class="board-header-btn-text u-text-underline">Any</span>');
  if(TrelloPro.settings.filters.priority) {
    for(let i=0; i<TrelloPro.data.priorities.length; i++) {
      if(TrelloPro.settings.filters.priority == TrelloPro.data.priorities[i].key) {
        $filter.attr('data-priority',TrelloPro.settings.filters.priority);
        $filter.text(TrelloPro.data.priorities[i].value + ' ('+TrelloPro.data.priorities[i].cardCount+')');
        break;
      }
    }
  }
  $menuItem.append('<span class="board-header-btn-icon icon-sm"><i class="fa fa-exclamation-triangle"></i></span>');
  $menuItem.append(jQuery('<span class="board-header-btn-text"><span>Priority: </span></span>').append($filter));

	// prepare popup
	let $popup = buildPopup('tpro-priority-popup','Filter via Priority');

  // add behaviour
  $menuItem.on('click',function(e){
    let $this = jQuery(this);
    if($popup.is(':visible')) { $popup.hide(); }
    else {
      // render project data
      let $list = $popup.find('ul.pop-over-list').html("");
      let selected = jQuery('#tpro-filter-priority').attr('data-priority');
      for(priority of TrelloPro.data.priorities) {
        let $a = jQuery(
          '<a class="js-select light-hover" data-priority="'+priority.key+'" href="#">'
            +priority.value+' <span>('+priority.cardCount+')</span>'
          +'</a>'
        );
        if(priority.key == selected) $a.addClass('disabled');
        $list.append(jQuery('<li></li>').append($a));
      }
      $list.prepend('<li><a class="js-select light-hover" data-priority="" href="#">Any</a></li>'); // default "all"

      // attach filter behaviour
      $list.find('li a').on('click',function(evt){
        let $this = jQuery(this);

        // update filter in menu
        $filter.attr('data-priority',$this.data().priority);
        $filter.text($this.text());

        // update filters
        let priority = $this.data().priority;
        TrelloPro.settings.filters.priority = (priority != "") ? priority : false;
        rebuildDynamicStyles();
        saveSettings();
				setTimeout(function(){
					refreshData('filter');
					refreshListsAndStats();
				},54);

        $popup.hide();

        evt.preventDefault();
        return false;
      });

      // show popup
			$popup.css({
        top: $this.position().top + $this.offset().top + $this.outerHeight(true) - $popup.height(),
        left: $this.offset().left
      }).show();
    }

    e.preventDefault();
    return false;
  });

	TrelloPro.$footer.find('.board-header-btns.mod-left').append($menuItem);
}

/**
 * Builds the Project Filter
 */
let buildProjectFilter = function () {
	if(!TrelloPro.settings['parse-projects']) return;
	log('building projects filter...');

  // create menu item
  let $menuItem = jQuery('<a id="tpro-header-button-projects" class="board-header-btn" href="#"></a>');

  // try to apply pre-loaded filter
  let $filter = jQuery('<span id="tpro-filter" data-project="" class="board-header-btn-text u-text-underline">Any</span>');
  if(TrelloPro.settings.filters.project) {
    for(let i=0; i<TrelloPro.data.projects.length; i++) {
      if(TrelloPro.settings.filters.project == TrelloPro.data.projects[i].key) {
        $filter.attr('data-project',TrelloPro.settings.filters.project);
        $filter.text(TrelloPro.data.projects[i].value + ' ('+TrelloPro.data.projects[i].cardCount+')');
        break;
      }
    }
  }
  $menuItem.append('<span class="board-header-btn-icon icon-sm"><i class="fa fa-bookmark"></i></span>');
  $menuItem.append(jQuery('<span class="board-header-btn-text"><span>Category: </span></span>').append($filter));

	// prepare popup
	let $popup = buildPopup('tpro-filter-popup','Filter via Category');

  // add behaviour
  $menuItem.on('click',function(e){
    let $this = jQuery(this);
    if($popup.is(':visible')) { $popup.hide(); }
    else {
      // render project data
      let $list = $popup.find('ul.pop-over-list').html("");
      let selected = jQuery('#tpro-filter').attr('data-project');
      for(project of TrelloPro.data.projects) {
        let $a = jQuery(
          '<a class="js-select light-hover" data-project="'+project.key+'" href="#">'
            +project.value+' <span>('+project.cardCount+')</span>'
          +'</a>'
        );
        if(project.key == selected) $a.addClass('disabled');
        $list.append(jQuery('<li></li>').append($a));
      }
      $list.prepend('<li><a class="js-select light-hover" data-project="" href="#">Any</a></li>'); // default "all"

      // attach filter behaviour
      $list.find('li a').on('click',function(evt){
        let $this = jQuery(this);

        // update filter in menu
        $filter.attr('data-project',$this.data().project);
        $filter.text($this.text());

        // update filters
        let project = $this.data().project;

        TrelloPro.settings.filters.project = (project != "") ? project : false;
        rebuildDynamicStyles();
        saveSettings();
				setTimeout(function(){
					refreshData('filter');
					refreshListsAndStats();
				},54);

        $popup.hide();

        evt.preventDefault();
        return false;
      });

      // show popup
			$popup.css({
        top: $this.position().top + $this.offset().top + $this.outerHeight(true) - $popup.height(),
        left: $this.offset().left
      }).show();
    }

    e.preventDefault();
    return false;
  });

	TrelloPro.$footer.find('.board-header-btns.mod-left').append($menuItem);
}

/**
 * Builds the Labels Filter
 */
let buildLabelsFilter = function () {
	if(!TrelloPro.settings['parse-labels']) return;
	log('building labels filter...');

  // create menu item
  let $menuItem = jQuery('<a id="tpro-header-button-labels" class="board-header-btn" href="#"></a>');

  // try to apply pre-loaded filter
  let $filter = jQuery('<span id="tpro-filter-labels" data-label="" class="board-header-btn-text u-text-underline">Any</span>');
  if(TrelloPro.settings.filters.label) {
    for(let i=0; i<TrelloPro.data.labels.length; i++) {
      if(TrelloPro.settings.filters.label == TrelloPro.data.labels[i].key) {
        $filter.attr('data-label',TrelloPro.settings.filters.label);
        $filter.text(TrelloPro.data.labels[i].value + ' ('+TrelloPro.data.labels[i].cardCount+')');
        break;
      }
    }
  }
  $menuItem.append('<span class="board-header-btn-icon icon-sm"><i class="fa fa-tag"></i></span>');
  $menuItem.append(jQuery('<span class="board-header-btn-text"><span>Tag: </span></span>').append($filter));

	// prepare popup
	let $popup = buildPopup('tpro-label-popup','Filter via Tag');

  // add behaviour
  $menuItem.on('click',function(e){
    let $this = jQuery(this);
    if($popup.is(':visible')) { $popup.hide(); }
    else {
      // render label data
      let $list = $popup.find('ul.pop-over-list').html("");
      let selected = jQuery('#tpro-filter-labels').attr('data-label');
      for(label of TrelloPro.data.labels) {
        let $a = jQuery(
          '<a class="js-select light-hover" data-label="'+label.key+'" href="#">'
            +label.value+' <span>('+label.cardCount+')</span>'
          +'</a>'
        );
        if(label.key == selected) $a.addClass('disabled');
        $list.append(jQuery('<li></li>').append($a));
      }
      $list.prepend('<li><a class="js-select light-hover" data-label="" href="#">Any</a></li>'); // default "all"

      // attach filter behaviour
      $list.find('li a').on('click',function(evt){
        let $this = jQuery(this);

        // update filter in menu
        $filter.attr('data-label',$this.data().label);
        $filter.text($this.text());

        // update filters
        let label = $this.data().label;

        TrelloPro.settings.filters.label = (label != "") ? label : false;
        rebuildDynamicStyles();
        saveSettings();
				setTimeout(function(){
					refreshData('filter');
					refreshListsAndStats();
				},54);

        $popup.hide();

        evt.preventDefault();
        return false;
      });

      // show popup
			$popup.css({
        top: $this.position().top + $this.offset().top + $this.outerHeight(true) - $popup.height(),
        left: $this.offset().left
      }).show();
    }

    e.preventDefault();
    return false;
  });

	TrelloPro.$footer.find('.board-header-btns.mod-left').append($menuItem);
}

/**
 * Builds the Hashtags Filter
 */
let buildHashtagsFilter = function () {
	if(!TrelloPro.settings['parse-hashtags']) return;
	log('building hashtags filter...');

  // create menu item
  let $menuItem = jQuery('<a id="tpro-header-button-hashtags" class="board-header-btn" href="#"></a>');

  // try to apply pre-loaded filter
  let $filter = jQuery('<span id="tpro-filter-hashtags" data-hashtag="" class="board-header-btn-text u-text-underline">Any</span>');
  if(TrelloPro.settings.filters.hashtag) {
    for(let i=0; i<TrelloPro.data.hashtags.length; i++) {
      if(TrelloPro.settings.filters.hashtag == TrelloPro.data.hashtags[i].key) {
        $filter.attr('data-hashtag',TrelloPro.settings.filters.hashtag);
        $filter.text('#' + TrelloPro.data.hashtags[i].value + ' ('+TrelloPro.data.hashtags[i].cardCount+')');
        break;
      }
    }
  }
  $menuItem.append('<span class="board-header-btn-icon icon-sm"><i class="fa fa-hashtag"></i></span>');
  $menuItem.append(jQuery('<span class="board-header-btn-text"><span>Hashtag: </span></span>').append($filter));

	// prepare popup
	let $popup = buildPopup('tpro-hashtag-popup','Filter via Hashtag');

  // add behaviour
  $menuItem.on('click',function(e){
    let $this = jQuery(this);
    if($popup.is(':visible')) { $popup.hide(); }
    else {
      // render hashtag data
      let $list = $popup.find('ul.pop-over-list').html("");
      let selected = jQuery('#tpro-filter-hashtags').attr('data-hashtag');
      for(hashtag of TrelloPro.data.hashtags) {
        let $a = jQuery(
          '<a class="js-select light-hover" data-hashtag="'+hashtag.key+'" href="#">'
            +'#'+hashtag.value+' <span>('+hashtag.cardCount+')</span>'
          +'</a>'
        );
        if(hashtag.key == selected) $a.addClass('disabled');
        $list.append(jQuery('<li></li>').append($a));
      }
      $list.prepend('<li><a class="js-select light-hover" data-hashtag="" href="#">Any</a></li>'); // default "all"

      // attach filter behaviour
      $list.find('li a').on('click',function(evt){
        let $this = jQuery(this);

        // update filter in menu
        $filter.attr('data-hashtag',$this.data().hashtag);
        $filter.text($this.text());

        // update filters
        let hashtag = $this.data().hashtag;

        TrelloPro.settings.filters.hashtag = (hashtag != "") ? hashtag : false;
        rebuildDynamicStyles();
        saveSettings();
				setTimeout(function(){
					refreshData('filter');
					refreshListsAndStats();
				},54);

        $popup.hide();

        evt.preventDefault();
        return false;
      });

      // show popup
			$popup.css({
        top: $this.position().top + $this.offset().top + $this.outerHeight(true) - $popup.height(),
        left: $this.offset().left
      }).show();
    }

    e.preventDefault();
    return false;
  });

	TrelloPro.$footer.find('.board-header-btns.mod-left').append($menuItem);
}

/**
 * Builds the Lists Filter
 */
let buildListsFilter = function () {
	log('building lists filter...');

  // create menu item
  let $menuItem = jQuery('<a id="tpro-header-button-lists" class="board-header-btn" href="#"></a>');

  // try to apply pre-loaded filter
  let $filter = jQuery('<span id="tpro-lists-filter" data-lists="[]" class="board-header-btn-text u-text-underline">'+TrelloPro.lists.length+'/'+TrelloPro.lists.length+'</span>');
  if(TrelloPro.settings.filters.lists) {
		let shown = TrelloPro.lists.length - TrelloPro.settings.filters.lists.length;
    $filter.text(shown + '/' + TrelloPro.lists.length);
  }
  $menuItem.append('<span class="board-header-btn-icon icon-sm icon-list"></span>');
  $menuItem.append(jQuery('<span class="board-header-btn-text"><span>Lists: </span></span>').append($filter));

	// prepare popup
	let $popup = buildPopup('tpro-listfilter-popup','Show/Hide Lists');

	// add behaviour
  $menuItem.on('click',function(e){
    let $this = jQuery(this);
    if($popup.is(':visible')) { $popup.hide(); }
    else {
      // render lists data
      let $ul = $popup.find('ul').html('');
			// let $ul = $popup.find('ul').html(
			// 	'<li class="check-filter-item show-all" href="#"><a href="#" style="float: right" class="filter-trigger">Show All</a></li>'
			// 	+ '<li class="check-filter-item hide-all" href="#"><a href="#" style="float: right" class="filter-trigger">Hide All</a></li>'
			// );
			if(!TrelloPro.settings.filters.lists) {
				TrelloPro.settings.filters.lists = [];
			}
			jQuery('#tpro-listfilter-popup').attr('data-lists');
      for(list of TrelloPro.lists) {
        let $li  = jQuery(
					'<li class="check-filter-item" data-list="'+list.id+'" href="#">'
					  +'<div class="check-filter-item-checkbox filter-trigger enabled">'
					    +'<span class="icon-sm icon-check check-filter-item-check"></span>'
					  +'</div>'
					  +'<div class="check-filter-item-details">'
					    +list.title+' ('+list.totalVisibleCards+')'
					  +'</div>'
					+'</li>'
        );
				if(jQuery.inArray(list.id, TrelloPro.settings.filters.lists) == -1) {
					$li.addClass('checked');
				}
        $ul.append($li);
      }

			// render special buttons
			let $showAll = $('<a href="#" style="float:left">Show All</a></li>');
			let $hideAll = $('<a href="#" style="float:right">Hide All</a></li>');
			$('<hr />').appendTo($ul).after(
				$('<div></div>').append($showAll).append($hideAll)
			);

      // attach filter behaviour
			$ul.find('.check-filter-item .filter-trigger').on('click',function(evt){
        let $this = jQuery(this).parent();
				let list = $this.data().list;
				if($this.hasClass('checked')) {
					// add list to hidden
					TrelloPro.settings.filters.lists.push(list);
					// remove dulpicates
					TrelloPro.settings.filters.lists = TrelloPro.settings.filters.lists.sort().filter(function(item, pos, arr) {
							return !pos || item != arr[pos - 1];
					});
					$this.removeClass('checked');
				} else {
					let index = TrelloPro.settings.filters.lists.indexOf(list);
					if (index !== -1) TrelloPro.settings.filters.lists.splice(index, 1);
					$this.addClass('checked');
				}

				refreshListFilter();
        rebuildDynamicStyles();
        saveSettings();

        evt.preventDefault();
        return false;
      });

			// attach special buttons behavior
			$showAll.on('click',function(e){
				e.preventDefault();
				TrelloPro.settings.filters.lists = [];
				$ul.find('.check-filter-item').addClass('checked');
				$popup.hide();

				refreshListFilter();
        rebuildDynamicStyles();
        saveSettings();
				return false;
			});
			$hideAll.on('click',function(e){
				e.preventDefault();
				// map all lists into filter
				TrelloPro.settings.filters.lists = $ul.find('.check-filter-item').removeClass('checked').map(function(i,item){
					return jQuery(item).data().list;
				}).get();
				// remove duplicates
				TrelloPro.settings.filters.lists = TrelloPro.settings.filters.lists.sort().filter(function(item, pos, arr) {
						return !pos || item != arr[pos - 1];
				});
				$popup.hide();

				refreshListFilter();
        rebuildDynamicStyles();
        saveSettings();
				return false;
			});

      // show popup
      $popup.css({
        top: $this.position().top + $this.offset().top + $this.outerHeight(true) - $popup.height(),
        left: $this.offset().left
      }).show();
    }

    e.preventDefault();
    return false;
  });

	TrelloPro.$footer.find('.board-header-btns.mod-left')
		.append($menuItem)
		.append('<span class="board-header-btn-divider"></span>');
}

/**
 * Builds stats for a list
 *
 * @param {jQuery} $list
 * @param {Object} list
 */
let buildListStats = function($list,list) {
  // init and clear stats
  let $stats = $list.parent().find('.tpro-list-stats');
  if($stats.length == 0) {
    $stats = jQuery('<div class="tpro-list-stats"></div>');

		// card count
		$stats.append(
	    '<span class="tpro-stat count" title="Total cards">'
	      +'<i class="fa fa-hashtag" aria-hidden="true"></i> '
	      +'<span></span>'
	    +'</span>'
	  );

		// tasks count
	  $stats.append(
	    '<span class="tpro-stat checklist" title="Checklist Tasks">'
	      +'<i class="fa fa-check-square-o" aria-hidden="true"></i> '
	      +'<span></span>'
	    +'</span>');

	  // points
	  if(TrelloPro.settings['parse-points']) {
			$stats.append(
		    '<span class="tpro-stat points" title="Total Points">'
		      +'<i class="fa fa-star" aria-hidden="true"></i> '
		      +'<span></span>'
		    +'</span>');
	  }

		// time entries
		if(TrelloPro.settings['parse-time-entries']) {
			$stats.append(
				'<span class="tpro-stat time-sum" title="Total Time">'
					+'<i class="fa fa-hourglass-1" aria-hidden="true"></i> '
					+'<span></span>'
				+'</span>');
		}

		// price entries
		if(TrelloPro.settings['parse-price-entries']) {
			$stats.append(
				'<span class="tpro-stat price-sum" title="Total Price">'
					+'<i class="fa fa-money" aria-hidden="true"></i> '
					+'<span></span>'
				+'</span>');
		}

		// progress bar
		if(TrelloPro.settings['show-list-stats-progressbar']) {
			$stats.append(
				'<div class="progress-bar-wrapper">'
					+'<div class="checklist-progress">'
						+'<span class="checklist-progress-percentage">0%</span>'
						+'<div class="checklist-progress-bar">'
							+'<div class="checklist-progress-bar-current" style="width: 0%;"></div>'
						+'</div>'
					+'</div>'
				+'</div>');
				$stats.css('height','50px');
		} else {
			$stats.css('height','30px');
		}

		$stats.insertBefore($list);
  }

  // card count
	$stats.find('.tpro-stat.count span').text(list.totalVisibleCards == list.totalCards
		? list.totalCards
		: list.totalVisibleCards + '/' + list.totalCards
	);

	// time sum
	$stats.find('.tpro-stat.time-sum span').text(list.totalVisibleTime == list.totalTime
		? list.totalTime
		: list.totalVisibleTime + '/' + list.totalTime
	);

	// price sum
	$stats.find('.tpro-stat.price-sum span').text(list.totalVisiblePrice == list.totalPrice
		? list.totalPrice
		: list.totalVisiblePrice + '/' + list.totalPrice
	);

  // tasks count
	$stats.find('.tpro-stat.checklist span').text(list.completedTasks + '/' + list.totalTasks);

  let formatPoints = function(points) {
		if(isNaN(points)) {
			points = 0;
		}

		let decimals = 0;
		if(Math.floor(points.valueOf()) !== points.valueOf()) {
			decimals = parseFloat(points).toFixed(2).toString().replace(/0+$/,'').split(".")[1].length || 0;
		}
    switch(decimals) {
			case 0: return parseInt(points);
			case 1: return parseFloat(points).toFixed(1);
			case 2: return parseFloat(points).toFixed(2);
		}
	}

  // points
  if(TrelloPro.settings['parse-points']) {
		$stats.find('.tpro-stat.points span').text(list.totalVisiblePoints == list.totalPoints
			? formatPoints(list.totalPoints)
			: formatPoints(list.totalVisiblePoints) + '/' + formatPoints(list.totalPoints)
		);
  }

	// TODO hours

	// progress bar
	if(TrelloPro.settings['show-list-stats-progressbar']) {
		let percentage = (list.totalTasks == 0) ? 100 : Math.floor((list.completedTasks*100)/list.totalTasks);
		$stats.find('.checklist-progress-bar-current').css('width',percentage+'%');
		$stats.find('.checklist-progress-percentage').text(percentage+'%');
	}
}

/**
 * Builds dynamic list enchancement menu
 *
 * @param {jQuery} $trigger
 */
let buildListEnhancementMenu = function($trigger) {
	let $list = $trigger.parents('.list-wrapper');
	let list = $list.data('tpro-list');

	let $menu = jQuery('<ul class="pop-over-list tpro-list-menu"></ul>');

	// background menu
	let $inputColor = jQuery('<input type="text" />');
	if(getListEnchancement(list,'background')) {
		$inputColor.val(getListEnchancement(list,'background'));
	}
	$inputColor.on('input', function(){
		setListEnchancement(list,'background',$inputColor.val());
		rebuildDynamicStyles();
		saveSettings();
	});
	jQuery('<li><strong>Background Color</strong></li>').append($inputColor).appendTo($menu);

	// width menu
	let $inputWidth = jQuery('<input type="text" />');
	if(getListEnchancement(list,'width')) {
		$inputWidth.val(getListEnchancement(list,'width'));
	}
	$inputWidth.on('input', function(){
		setListEnchancement(list,'width',$inputWidth.val());
		rebuildDynamicStyles();
		saveSettings();
	});
	jQuery('<li><strong>List Width</strong></li>').append($inputWidth).appendTo($menu);

	setTimeout(function(){
		let $insertPoint = jQuery('.pop-over.is-shown .pop-over-list:last');
		$insertPoint.before($menu);
		$insertPoint.before('<hr />');
	}, 54);
}

/**
 * Builds (prepares) initial data
 *
 * @return {Promise}
 */
let buildInitialData = function() {
	log('Building initial data...');
	return new Promise((resolve,reject) => {
		buildData();
		resolve();
	});
}

// -----------------------------------------------------------------------------
// Loaders
// -----------------------------------------------------------------------------

/**
 * Loads CSS styles for the current board
 *
 * @return {Promise}
 */
let loadCss = function(){
	log('loading CSS...');

	return new Promise((resolve,reject) => {
		// label sizes CSS
		if(TrelloPro.settings['visible-labels']) {
			jQuery('body').addClass('tpro-card-labels-size-'+TrelloPro.settings['labels-size']);
		} else {
			jQuery('body').removeClass('tpro-card-labels-size-'+TrelloPro.settings['labels-size']);
		}

		// list stats CSS
		if(TrelloPro.settings['show-list-stats']) {
			jQuery('body').addClass('tpro-show-list-stats');
		} else {
			jQuery('body').removeClass('tpro-show-list-stats');
		}

		// custom background
		if (TrelloPro.settings['custom-background'] && TrelloPro.settings['custom-background-input'] !== "") {
			let $customBackgroundStyle = jQuery('<style id="tpro-custom-background-css">#trello-root { background-image: url("'+TrelloPro.settings['custom-background-input']+'") !important }</style>');
			jQuery('body').append($customBackgroundStyle);
		} else {
			let $customBackgroundStyle = jQuery("#tpro-custom-background-css");
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
		else {
			jQuery("#tpro-custom-css").remove();
		}

		toggleCssInject('visible-card-numbers');
		toggleCssInject('visible-labels');
		toggleCssInject('hide-activity-entries');
		toggleCssInject('full-screen-cards');
		toggleCssInject('hide-add-list');
		toggleCssInject('beautify-markdown');
		toggleCssInject('compact-cards');

		resolve();
	});
};

/**
 * Applies settings to current cards
 *
 * @return {Promise}
 */
let parseCurrentCards = function() {
	log('parsing current cards...');
	let $initCards = jQuery('.list-card-title');
	let promises = [];
	for(let i=0; i<$initCards.length; i++) {
		promises.push(processCardTitleChange(jQuery($initCards[i]),false));
	}
	return Promise.all(promises);
}

/**
 * Loads Pro4Trello
 */
let loadBoard = function () {
	// load for boards only
	if(window.location.href.split('/')[3] != 'b') return;

  // get board ID and title
  let boardId = window.location.href.split('/')[4];
  let boardTitle = jQuery.trim(jQuery('title').text());

	// prevent double loading
	if(TrelloPro.boardId == boardId) return;

	// identify for current board
	TrelloPro.boardId = boardId;
  TrelloPro.boardTitle = boardTitle;
	TrelloPro.loaded = false;
	rebuildDynamicStyles();
	log('loading settings for board "' + boardId + '"...');

  // load settings
  TrelloPro.settings = TrelloPro.config.defaultSettings; // TODO get 'data_'+TrelloPro.boardId
  chrome.storage.sync.get(['defaults',TrelloPro.boardId,'autohide'], function (settings) {
		log('[loaded board settings]');

		// set board-specific settings flag
		TrelloPro.settingsOverride = settings[TrelloPro.boardId] ? true : false;

		// get defaults and board-specific settings
		let defaults = settings['defaults'] ? settings['defaults'] : {};
		let boardSettings = settings[TrelloPro.boardId] ? settings[TrelloPro.boardId] : {};

		// set auto-hide settings
		TrelloPro.autoHideFooter = settings['autohide'];
		if(typeof TrelloPro.autoHideFooter !== 'boolean') {
			TrelloPro.autoHideFooter = false;
		}

		// merge settings
		TrelloPro.settings = jQuery.extend({}, TrelloPro.settings, defaults);
		TrelloPro.settings = jQuery.extend({}, TrelloPro.settings, boardSettings);

		// TODO set data?
		//TrelloPro.data = settings['data_'+TrelloPro.boardId] ? settings['data_'+TrelloPro.boardId] : null;

    setTimeout(function(){
			log('loading board...');
			loadCss()
				.then(() => parseCurrentCards())
				.then(() => buildInitialData())
				.then(() => {
					log('[ TrelloPro loaded ]');
					TrelloPro.loaded = true;
					buildFooter();
					refreshListsAndStats();
					buildListsFilter();
					buildPriorityFilter();
					buildProjectFilter();
					buildLabelsFilter();
					buildHashtagsFilter();
					rebuildDynamicStyles();
					buildSettingsPane();
					buildMenu();
				})
		}, 500);
  });
}

// -----------------------------------------------------------------------------
// Start
// -----------------------------------------------------------------------------

/**
 * Initializes the content script
 */
let tpro = function(){
	log('Pro4Trello intiialized...');
	TrelloPro.refreshing = false;

	// introduce dynamic styles
  TrelloPro.$dynamicStyles = jQuery('<style id="tpro-dynamic-css"></style>').appendTo(jQuery('body'));

  // load CSS
  if(jQuery('#trello-pro-css-fa').length == 0) {
    jQuery('body').append('<link id="trello-pro-css-fa" href="'+chrome.runtime.getURL("lib/font-awesome/css/font-awesome.min.css")+'" rel="stylesheet">');
	}
	if(jQuery('#trello-pro-css-share').length == 0) {
    jQuery('body').append('<link id="trello-pro-css-share" href="'+chrome.runtime.getURL("css/share.css")+'" rel="stylesheet">');
	}

	// bind ESC key
	jQuery(document).bind('keyup', function(e) {
		if(!TrelloPro.loaded) return;

		if(e.keyCode === 27) {

			// filter popup
			let $popup = jQuery('.tpro-popup');
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
		if(!TrelloPro.loaded) return;

		// facilitate closing popups
		jQuery('.tpro-popup').each(function(){
			let $popup = jQuery(this);
			if (!$popup.is(e.target) && $popup.has(e.target).length === 0) {
					$popup.hide();
					return;
			}
		});

		let $target = jQuery(e.target);

		// capture list settings appearance
		if($target.hasClass('list-header-extras-menu')) {
			buildListEnhancementMenu($target);
			return;
		}

	});

	// catch board changes
	jQuery('title').bind("DOMSubtreeModified",function(){
	  let title = jQuery.trim(jQuery(this).text());
	  let path = window.location.href.split('/');

	  if(path[3] != 'b') return; // works for boards only, not cards

		// check if board was changed
	  if(title == TrelloPro.boardTitle || TrelloPro.boardId == path[4]) {
			TrelloPro.loaded = true; // unlock everything
			return;
		}

	  loadBoard();
	});

	// react on card title changes
	jQuery(document).on('DOMSubtreeModified', '.list-card-title', function (e) {
		//if(!TrelloPro.loaded) return;
		let $card = jQuery(this).parents('.list-card');
		if ($card.hasClass('placeholder') || $card.css('position') == 'absolute') return;
		processCardTitleChange($card.find('.list-card-title'),false);
	});

	// react on list title changes
	jQuery(document).on('blur', '.list-header-name', function (e) {
		if(!TrelloPro.loaded) return;
		let $list = jQuery(this).parents('.list-wrapper');
		processListTitleChange($list);
	});

	// bind add element
	jQuery(document).bind('DOMNodeInserted', function(e) {
		if(!TrelloPro.loaded) return;
		let $card = jQuery(e.target);
		if (!$card.hasClass('list-card') || $card.hasClass('placeholder') || $card.css('position') == 'absolute') return;
		//processCardTitleChange($card.find('.list-card-title'),true);
		processCardTitleChange($card.find('.list-card-title'),false);
	});

	// bind mouse movements for show/hide footer
	jQuery('body').on('mousemove',function(e) {
		if(!TrelloPro.loaded) return;
		if(!TrelloPro.autoHideFooter) return;
	  if(window.innerHeight - e.pageY >= 44) {
			if(TrelloPro.$footer.is(':visible')) TrelloPro.$footer.hide();
		}
		else {
			if(!TrelloPro.$footer.is(':visible')) TrelloPro.$footer.show();
		}
	});

	// bind element removal
	// jQuery(document).bind('DOMNodeInserted', function(e) {
	// 	if(!TrelloPro.loaded) return;
	// 	let $target = jQuery(e.target);
	//
	// 	// rebuild menu if removed by Trello
	// 	if($target.attr('id') === 'tpro-menu-button') {
	// 		buildMenu();
	// 	}
	//
	// });

	// inject special event tracker
	let $changeTrigger = jQuery('<input type="hidden" id="trpo-history-state-change-trigger" value="" />');
	jQuery('body')
		.append($changeTrigger)
		.append(
			'<script type="text/javascript"> '
				+'var tproEvent = document.getElementById("trpo-history-state-change-trigger"); '
				+'let replaceStateOrigin = history.replaceState; '
				+'history.replaceState = function(state){ '
					+'tproEvent.value = "history.replaceState"; '
					+'let e = document.createEvent("HTMLEvents"); e.initEvent("change", false, true); tproEvent.dispatchEvent(e); '
					+'replaceStateOrigin.apply(history, arguments); '
				+'}; '
				+'let pushStateOrigin = history.pushState; '
				+'history.pushState = function(state){ '
					+'tproEvent.value = "history.pushState"; '
					+'let e = document.createEvent("HTMLEvents"); e.initEvent("change", false, true); tproEvent.dispatchEvent(e); '
					+'pushStateOrigin.apply(history, arguments); '
				+'}'
			+'</script>'
		);

	// handle events
	$changeTrigger.on('change',function(){
		if(!TrelloPro.loaded) return;

		let evt = jQuery(this).val();
		switch (evt) {
			case 'history.replaceState':
				log('<< history.replaceState detected >>');
				// refresh data after Trello filter replaces state
				setTimeout(function(){ refreshData('history'); },54);
				return;
			case 'history.pushState':
				log('<< history.pushState detected >>');
				// lock everything
				TrelloPro.loaded = false;
				return;
		}
	});

	// start loading the extension
	loadBoard();

	// trigger parsing current cards every 10 seconds
	(triggerParseCurrentCards = function() {
		parseCurrentCards();
		setTimeout(triggerParseCurrentCards,10000);
	})();

	// trigger data refresh every 30 seconds
	(triggerRefreshData = function() {
		refreshData('periodical');
		setTimeout(triggerRefreshData,30000);
	})();

	// trigger stats every 7.5 seconds
	(triggerRefreshListStats = function() {
		refreshListsAndStats();
		setTimeout(triggerRefreshListStats,7500);
	})();

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
	//     else loadBoard();
	//   });
	// }
};

tpro();
