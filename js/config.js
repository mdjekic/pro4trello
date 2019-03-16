var TrelloPro = TrelloPro || {};

TrelloPro.config = {

	regex: {
		tags: [/(.*\ \:\:\ )/,/(.*\ \|\ )/],
		labels: /(\[[^\]]*\])/g,
		hashtags: /\W(\#[a-zA-Z]+\b)(?!;)/gm,
		time_entries: /(\{[^\}]*\})/g,
		points: /(\|[^\}]*\|)/g
	},

	renderers: {
		tags: function(capture) { return capture.replace(' :: ','').replace(' | ',''); },
		labels: function(capture) { return capture.replace('[','').replace(']',''); },
		hashtags: function(capture) { return ' ' +capture },
		time_entries: function(capture) { return capture.replace('{','').replace('}',''); },
		points: function(capture) { return capture.split('|').join(''); }
	},

	symbols: {
		label: '<i class="fa fa-tag" aria-hidden="true"></i>',
		time_entry: '<i class="fa fa-hourglass-1" aria-hidden="true"></i>',
		point: '<i class="fa fa-star" aria-hidden="true"></i>',
	},

	defaultSettings: {
		'filters': {},

		'parse-projects': false,
		'parse-labels': false,
		'parse-hashtags': false,
		'parse-time-entries': false,
		'parse-priority-marks': false,

		'parse-points': false,
		'parse-markup': false,
		'visible-card-numbers': false,
		'visible-labels': false,
		'labels-size': 'medium',
		'beautify-markdown': false,
		'hide-activity-entries': false,

		'full-screen-cards': false,
		'custom-background': false,
		'custom-background-input': '',
		'compact-cards': false,
		'show-list-stats': false,
		'show-list-stats-progressbar': false,
		'hide-add-list': false,
		'custom-css': false,
		'custom-css-input': ''
	}
}
