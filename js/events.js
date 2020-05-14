// listen to install/update events
chrome.runtime.onInstalled.addListener(function(details){
	switch(details.reason) {
		case 'install':
			chrome.tabs.create({url: '/docs/pro-for-trello-installed.html'});
			break;
		case 'update':
			var version = chrome.runtime.getManifest().version;
			
			if(version == '2.0.1') { // minor update (before ppl updated to 2.0)
				chrome.tabs.create({url: '/docs/pro-for-trello-updated-to-2.0.html'});
				break;
			} 			
			else if(version == '3.2.1') { // migrate all settings and data to local storage, thank you Google :(
				let migrate = {};
				chrome.storage.sync.get(function(data){					
					for(let key in data) {
						if(key == 'autohide' || key.indexOf('lists_') == 0 || key.indexOf('data_') == 0) {
							migrate[key] = data[key];
							continue;
						}
						migrate['board_' + key] = data[key];
					}
					chrome.storage.local.set(migrate);
				});
			}

			if(version.split('.').length > 2) break; // ignore minor versions
			chrome.tabs.create({url: '/docs/pro-for-trello-updated-to-'+version+'.html'});
			break;
	}
});