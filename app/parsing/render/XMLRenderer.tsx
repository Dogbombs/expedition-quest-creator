import {Renderer, CombatChild, Instruction, RoleplayChild} from './Renderer'

var cheerio: any = require('cheerio');

// TODO: Move error checks in this renderer to the QDLRenderer class.
export var XMLRenderer: Renderer = {
  toRoleplay: function(attribs: {[k: string]: string}, body: (string|RoleplayChild|Instruction)[]): any {
    var roleplay = cheerio.load('<roleplay>')('roleplay');

    var keys = Object.keys(attribs);
    for (var i = 0; i < keys.length; i++) {
      roleplay.attr(keys[i], attribs[keys[i]]);
    }

    for (var i = 0; i < body.length; i++) {
      var section = body[i];
      if (typeof(section) === 'string') {
        // TODO: Deeper markdown rendering of lines.
        // '/(\*\*|__)(.*?)\1/' => '<strong>\2</strong>',            // bold
        // '/(\*|_)(.*?)\1/' => '<em>\2</em>',                       // emphasis
        roleplay.append('<p>' + section + '</p>');
      } else if ((section as RoleplayChild).choice != null) { // choice
        var c = section as RoleplayChild;
        var choice = cheerio.load('<choice></choice>')('choice');
        choice.attr('text', c.text);
        if (c.visible) {
          choice.attr('if', c.visible);
        }
        choice.append(c.choice);
        roleplay.append(choice);
      } else { // instruction
        var node = section as Instruction;
        var instruction = cheerio.load('<instruction></instruction>')('instruction');
        instruction.append('<p>' + node.text + '</p>');
        if (node.visible) {
          instruction.attr('if', node.visible);
        }
        roleplay.append(instruction);
      }
    }
    return roleplay;
  },

  toCombat: function(attribs: {[k: string]: any}, events: CombatChild[]): any {
    var combat = cheerio.load('<combat></combat>')("combat");

    var keys = Object.keys(attribs);
    for (var i = 0; i < keys.length; i++) {
      if (keys[i] !== 'enemies') {
        combat.attr(keys[i], attribs[keys[i]]);
      }
    }

    var enemies = attribs['enemies'];
    for (var i = 0; i < enemies.length; i++) {
      var e = cheerio.load('<e>'+enemies[i].text+'</e>')('e');
      e.attr('if', enemies[i].visible);
      combat.append(e);
    }

    for (var i = 0; i < events.length; i++) {
      var event = events[i];
      var currEvent: any = cheerio.load('<event></event>')('event');
      currEvent.attr('on', event.text.substr(3));
      if (event.visible) {
        currEvent.attr('if', event.visible);
      }
      for (var j = 0; j < event.event.length; j++) {
        currEvent.append(event.event[j]);
      }
      combat.append(currEvent);
    }
    return combat;
  },

  toTrigger: function(attribs: {[k: string]: any}): any {
    var trigger = cheerio.load('<trigger>'+attribs['text']+'</trigger>')('trigger');
    if (attribs['visible']) {
      trigger.attr('if', attribs['visible']);
    }
    return trigger;
  },

  toQuest: function(attribs: {[k: string]: string}): any {
    var quest = cheerio.load('<quest>')('quest');
    var keys = Object.keys(attribs);
    for(var i = 0; i < keys.length; i++) {
      quest.attr(keys[i], attribs[keys[i]]);
    }
    return quest;
  },

  finalize: function(quest: any, inner: any[]): any {
    for (var i = 0; i < inner.length; i++) {
      quest.append(inner[i]);
    }
    return quest;
  }
};