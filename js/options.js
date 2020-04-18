var TrelloProSettings = {};

jQuery(function(){

  /**
   * Blocks UI
   */
  let block = function() {
    $.blockUI({
      message: '<i class="fa fa-spinner" aria-hidden="true"></i>',
      css: {
        backgroundColor: 'transparent',
        color: 'whitesmoke',
        border: 'none'
      }
    });
  }

  let unblock = $.unblockUI;

  /**
   * Synchronizes settings
   */
  let syncSettings = function() {
    block();

    let $this = jQuery(this);
    if($this.attr('type') == 'checkbox') TrelloProSettings[$this.attr('name')] = $this.is(':checked');
    else TrelloProSettings[$this.attr('name')] = $this.val();

    let settings = {};
    settings['defaults'] = TrelloProSettings;
    chrome.storage.sync.set(settings, unblock);
  };

  // load settings
  block();
  TrelloProSettings = TrelloPro.config.defaultSettings;
  chrome.storage.sync.get('defaults', function (settings) {
    if(settings['defaults']) TrelloProSettings = jQuery.extend({}, TrelloProSettings, settings['defaults']);

    // apply settings
    for (let key in TrelloProSettings)
    {
      // try checkbox
      let checkbox = jQuery('input[type="checkbox"][name="' + key + '"]');
      if (checkbox.length != 0) {
        if (TrelloProSettings[key]) checkbox.attr('checked', true);
        else checkbox.removeAttr('checked');
        continue;
      }

      // try text input
      let input = jQuery('textarea[name="' + key + '"]');
      if (input.length != 0) {
        input.val(TrelloProSettings[key]);
        continue;
      }

      // try text
      let textarea = jQuery('input[type="text"][name="' + key + '"]');
      if (textarea.length != 0) {
        textarea.val(TrelloProSettings[key]);
        continue;
      }

      // try radio
      let radio = jQuery('input[type="radio"][name="' + key + '"][value="' + TrelloProSettings[key] + '"]');
      if(radio.length != 0) {
        radio.attr('checked',true);
        continue;
      }
    }

    // add sync triggers
    jQuery('input[type="checkbox"]').on('change',syncSettings);
    jQuery('input[type="text"]').on('input',syncSettings);
    jQuery('input[type="radio"]').on('change',syncSettings);
    jQuery('textarea').on('input',syncSettings);

    unblock();
  });

});
