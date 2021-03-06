/**
 * Provides general useful functions for various different parts of the system.
 *
 * This is basically a catch-all for useful functions that don't quite fit anywhere
 * else, but is used by many different areas of the system. Most of these functions
 * involve retrieving data from the configuration values or the compendia.
 *
 */
class WFRP_Utility
{
  /**
   * Augments the spell item's description with the lore effect
   * 
   * The spell's lore is added at the end of the spell's description for
   * an easy reminder. However, this causes issues because we don't want
   * the lore to be 'saved' in the description. So we append the lore
   * if it does not already exist
   * 
   * @param {Object} spell 'spell' type item
   */
  static _spellDescription(spell)
  {
    let description = spell.data.description.value;
    if (description && description.includes("<b>Lore:</b>"))
      return description

    // Use lore override if it exists
    if (spell.data.lore.effect)
      description += "\n\n <b>Lore:</b> " + spell.data.lore.effect;
    // Otherwise, use config value for lore effect
    else if (WFRP4E.loreEffect[spell.data.lore.value])
      description += "\n\n <b>Lore:</b> " + WFRP4E.loreEffect[spell.data.lore.value];
    return description;
  }


  static propertyText(property)
  {
    let properties = mergeObject(WFRP_Utility.qualityList(), WFRP_Utility.flawList()), // Property names
        propertyDescr = Object.assign(duplicate(WFRP4E.qualityDescriptions), WFRP4E.flawDescriptions); // Property descriptions

    property = this.parsePropertyName(property.replace(/,/g, '').trim());
    let propertyKey = "";
    propertyKey = WFRP_Utility.findKey(property.split(" ")[0], properties)

    let propertyDescription = "<b>" + property + "</b>" + ": " + propertyDescr[propertyKey];
    if (propertyDescription.includes("(Rating)"))
      propertyDescription = propertyDescription.replace("(Rating)", property.split(" ")[1])

    if (property.includes("Momentum"))
    {
      let innerProperty = property.substring(property.indexOf("(")+1, property.indexOf(")"))
      let innerPropertyDescr = this.propertyText(innerProperty)

      propertyDescription += 
      `
      <br><br>
      ${innerPropertyDescr}
      `;
    }
    return propertyDescription
  }

  /**
   * Used when preparing armour - every time an armour item is prepared it's added as a layer. Each
   * layer has booleans for qualities/flaws and an AP value
   * 
   * @param {Object} AP     AP object defined in actor preparation (see ActorWfrp4e.prepareItems()) - consists of layers
   * @param {Object} armor  'armour' Item type - armour layer that is being added
   * @param {String} loc    Location key to lookup AP value at that location
   */
  static addLayer(AP, armor, loc)
  {
    let layer = {
      value: armor.data.currentAP[loc]
    }
    if (armor.properties.qualities.includes("Impenetrable"))
      layer.impenetrable = true;
    if (armor.properties.flaws.includes("Partial"))
      layer.partial = true;
    if (armor.properties.flaws.includes("Weakpoints"))
      layer.weakpoints = true;
    if (armor.data.armorType.value == "plate" || armor.data.armorType.value == "mail")
      layer.metal = true;

    AP[loc].layers.push(layer);
  }

  /**
   * Sorts qualities and flaws into an array of strings.
   * 
   * @param {Object}  item                Weapon/armor with qualities/flaws.  
   * @param {Boolean} includeQualities    Whether to include qualities (false if skill not present)
   */
  static _prepareQualitiesFlaws(item, includeQualities = true)
  {
    let qualities = item.data.qualities.value.split(",").map(function (item)
    {
      if (item)
      {
        item = item.trim();
        if (!(Object.values(WFRP_Utility.qualityList()).includes(item) || (Object.values(WFRP_Utility.flawList()).includes(item)))) //if the quality does not show up in either quality or flaw list, add it
          WFRP4E.itemQualities[item.toLowerCase().trim()] = item;
        return item
      }
    });
    let flaws = item.data.flaws.value.split(",").map(function (item)
    {
      if (item)
      {
        item = item.trim();
        if (!(Object.values(WFRP_Utility.flawList()).includes(item) || (Object.values(WFRP_Utility.qualityList()).includes(item)))) //if the quality does not show up in either quality or flaw list, add it
          WFRP4E.itemFlaws[item.toLowerCase().trim()] = item;
        return item;
      }
    });

    if (!includeQualities)
      qualities = [];


    if (!item.data.special.value)
      return qualities.concat(flaws).sort().filter(p => !!p);
    else
      return qualities.concat(flaws).sort().concat(game.i18n.localize("Special")).filter(p => !!p);

  }

  /**
   * Sorts qualities and flaws into a more organized object.
   * 
   * @param {Array} properties    Array of strings listing qualities/flaws 
   */
  static _separateQualitiesFlaws(properties)
  {
    let qualities = [],
      flaws = [],
      special = [];
    let allQualities = Object.values(this.qualityList());
    let allFlaws = Object.values(this.flawList());
    for (let prop of properties)
    {
      if (allQualities.includes(this.parsePropertyName(prop)))
        qualities.push(prop);
      else if (allFlaws.includes(this.parsePropertyName(prop)))
        flaws.push(prop);
      else
        special.push(prop);
    }
    return {
      qualities: qualities,
      flaws: flaws,
      special: special
    }
  }

  /**
   * Roll characteristics given a species, or take average depending input
   * 
   * @param {string} species      Key or value for species in config
   * @param {bool} average        Take average or not
   */
  static speciesCharacteristics(species, average)
  {
    let characteristics = {};
    let characteristicFormulae = WFRP4E.speciesCharacteristics[species];
    try
    {
      if (!characteristicFormulae) // If input species was not a valid key, try finding it as a value
        characteristicFormulae = WFRP4E.speciesCharacteristics[this.findKey(species, WFRP4E.species)]
    }
    catch (error)
    {
      ui.notifications.info("Could not find species " + species)
      console.log("Could not find species " + species + ": " + error);
      throw error
    }

    for (let char in WFRP4E.characteristics)
    {
      if (average)
      {
        // Take average - 2d10+20 -> split on +, take the 20, add 10 (average of 2d10). This assumes, perhaps erroneously, that all species will have a 2d10 randomizer
        characteristics[char] = parseInt(characteristicFormulae[char].split("+")[1]) + 10
      }
      else
      {
        characteristics[char] = new Roll(characteristicFormulae[char]).roll().total;
      }
    }
    return characteristics
  }

  /**
   * Retrieves species movement value from config.
   * 
   * @param {String} species  species key for lookup
   */
  static speciesMovement(species)
  {
    let move = WFRP4E.speciesMovement[species];
    if (!move) // If input species was not a valid key, try finding it as a value
      move = WFRP4E.speciesMovement[this.findKey(species, WFRP4E.species)]
    return move;
  }

  /**
   * Searches an object for a key that matches the given value.
   * 
   * @param {String} value  value whose key is being searched for
   * @param {Object} obj    object to be searched in
   */
  static findKey(value, obj)
  {
    for (let key in obj)
    {
      if (obj[key] == value)
        return key;
    }
    throw "Could not find key corresponding to " + value
  }

  /**
   * Specialized function to find a skill that accommodates for specializations.
   * 
   * Special considerations needs to be provided for finding skills because of specializations.
   * First, it will try to find the skill exactly, if that cannot be found, remove the specialization
   * and try to find any skill that would match if it had no specialization. If it is found, it will 
   * return that skill, renaming it to match the query.
   * 
   * For example, input could be Lore (Cheese), which doesn't exist. So it will try again testing
   * with just the skill "Lore", and trying to match it with any other skill by removing its 
   * specialization as well. Thus, lore matches with the first Lore skill, which should be 
   * the blank "Lore ()" skill. This is renamed as Lore (Cheese) and returned.
   * 
   * @param {String} skillName skill name to be searched for
   */
  static async findSkill(skillName)
  {
    let skillList = [];
    let packs = game.packs.filter(p => p.metadata.tag == "skill")
    for (let pack of packs)
    {
      await pack.getIndex().then(index => skillList = index);
      // Search for specific skill (won't find unlisted specializations)
      let searchResult = skillList.find(s => s.name == skillName)
      if (!searchResult)
        searchResult = skillList.find(s => s.name.split("(")[0].trim() == skillName.split("(")[0].trim())

      if (searchResult)
      {
        let dbSkill;
        await pack.getEntity(searchResult._id).then(packSkill => dbSkill = packSkill);
        dbSkill.data.name = skillName; // This is important if a specialized skill wasn't found. Without it, <Skill ()> would be added instead of <Skill (Specialization)>
        return dbSkill;
      }
    }
    throw "Could not find skill (or specialization of) " + skillName + " in compendum"

  }

  /**
   * Specialized function to find a talent that accommodates for specializations.
   * 
   * Special considerations needs to be provided for finding talents because of specializations.
   * First, it will try to find the talent exactly, if that cannot be found, remove the specialization
   * and try to find any talent that would match if it had no specialization. If it is found, it will 
   * return that talent, renaming it to match the query.
   * 
   * For example, input could be Etiquette (Cheesemongers), which doesn't exist. So it will try again testing
   * with just the talent "Etiquette", and trying to match it with any other talent by removing its 
   * specialization as well. Thus, Etiquette matches with the first Etiquette talent, which should be 
   * the blank "Etiquette ()" talent. This is renamed as Etiquette (Cheesemongers) and returned.
   * 
   * @param {String} talentName talent name to be searched for
   */
  static async findTalent(talentName)
  {
    let talentList = [];
    let packs = game.packs.filter(p => p.metadata.tag == "talent")
    for (let pack of packs)
    {
      await pack.getIndex().then(index => talentList = index);
      // Search for specific talent (won't find unlisted specializations)
      let searchResult = talentList.find(t => t.name == talentName)
      if (!searchResult)
        searchResult = talentList.find(t => t.name.split("(")[0].trim() == talentName.split("(")[0].trim())

      if (searchResult)
      {
        let dbTalent;
        await pack.getEntity(searchResult._id).then(packTalent => dbTalent = packTalent);
        dbTalent.data.name = talentName; // This is important if a specialized talent wasn't found. Without it, <Talent ()> would be added instead of <Talent (Specialization)>
        return dbTalent;
      }
    }
    throw "Could not find talent (or specialization of) " + talentName + " in compendium"
  }


  /**
   * 
   * @param {String} itemName   Item name to be searched for 
   * @param {String} itemType   Item's type (armour, weapon, etc.)
   * @param {String} location   Compendium to look into, format: <package.name> - "wfrp4e.trappings"
   */
  static async findItem(itemName, itemType, location = null)
  {
    let items = game.items.entities.filter(i => i.type == itemType)

    // Search imported items first
    for (let i of items)
    {
      if (i.name == itemName && i.type == itemType)
        return i;
    }
    let itemList

    // find pack -> search pack -> return entity
    if (location)
    {
      let pack = game.packs.find(p =>
      {
        location.split(".")[0] == p.metadata.package &&
          location.split(".")[1] == p.metadata.name
      })
      if (pack)
      {
        await pack.getIndex().then(index => itemList = index);
        let searchResult = itemList.find(t => t.name == itemName)
        if (searchResult)
          return await pack.getEntity(searchResult._id)
      }
    }

    // If all else fails, search each pack
    for (let p of game.packs)
    {
      await p.getIndex().then(index => itemList = index);
      let searchResult = itemList.find(t => t.name == itemName)
      if (searchResult)
        return await p.getEntity(searchResult._id)
    }
  }


  // Used to sort arrays based on string value (used in organizing skills to be alphabetical - see ActorWfrp4e.prepareItems())
  static nameSorter(a, b)
  {
    if (a.name.toLowerCase() < b.name.toLowerCase())
      return -1;
    if (a.name.toLowerCase() > b.name.toLowerCase())
      return 1;
    return 0;
  }

  /**
   * Return a list of all qualities
   */
  static qualityList()
  {
    let weapon = duplicate(WFRP4E.weaponQualities);
    let armor = duplicate(WFRP4E.armorQualities);
    let item = duplicate(WFRP4E.itemQualities);
    let list = mergeObject(weapon, mergeObject(item, armor))
    return list;
  }


  /**
   * Return a list of all flaws
   */
  static flawList()
  {
    let weapon = duplicate(WFRP4E.weaponFlaws);
    let armor = duplicate(WFRP4E.armorFlaws);
    let item = duplicate(WFRP4E.itemFlaws);
    let list = mergeObject(weapon, mergeObject(item, armor))
    return list;
  }

  /**
   * Looks up advancement cost based on current advancement and type.
   * 
   * @param {var} currentAdvances   Number of advances currently 
   * @param {String} type           "characteristic" or "skill"
   */
  static _calculateAdvCost(currentAdvances, type)
  {
    let index = Math.floor(currentAdvances / 5);
    index = index < 0 ? 0 : index; // min 0

    if (index >= WFRP4E.xpCost[type].length)
      return WFRP4E.xpCost[WFRP4E.xpCost.length - 1];
    return WFRP4E.xpCost[type][index];
  }

  /**
   * Creates a chat message with current conditions and penalties to an actor.
   * 
   * @param {String} tokenId  Token id to retrieve token from canvas
   * @param {Object} round    Round object to display round number
   */
  static displayStatus(tokenId, round = undefined)
  {
    let token = canvas.tokens.get(tokenId);
    let effects = token.data.effects;
    if (round)
      round = "- Round " + round;

    // Aggregate conditions to be easily displayed (bleeding4 and bleeding1 turns into Bleeding 5)
    let displayConditions = this.parseConditions(effects);

    let chatOptions = {
      rollMode: game.settings.get("core", "rollMode")
    };
    if (["gmroll", "blindroll"].includes(chatOptions.rollMode)) chatOptions["whisper"] = ChatMessage.getWhisperIDs("GM");
    if (chatOptions.rollMode === "blindroll") chatOptions["blind"] = true;
    chatOptions["template"] = "systems/wfrp4e/templates/chat/combat-status.html"


    let chatData = {
      name: token.name,
      conditions: displayConditions,
      modifiers: token.actor.data.flags.modifier,
      round: round
    }


    return renderTemplate(chatOptions.template, chatData).then(html =>
    {
      chatOptions["user"] = game.user._id

      // Emit the HTML as a chat message
      chatOptions["content"] = html;
      chatOptions["type"] = 0;
      ChatMessage.create(chatOptions, false);
      return html;
    });
  }


  /**
   * Displays all combatants with conditions effecting them, used at the end of the Round.
   * 
   * @param {Object} combat  FVTT combat object listing all combatants
   */
  static displayRoundSummary(combat)
  {
    let combatantArray = [];

    for (let turn of combat.turns)
    {
      let token = canvas.tokens.get(turn.tokenId);
      let effects = token.data.effects;
      combatantArray.push(
      {
        name: token.name,
        conditions: this.parseConditions(effects)
      })
    }

    let chatOptions = {
      rollMode: game.settings.get("core", "rollMode")
    };
    if (["gmroll", "blindroll"].includes(chatOptions.rollMode)) chatOptions["whisper"] = ChatMessage.getWhisperIDs("GM");
    if (chatOptions.rollMode === "blindroll") chatOptions["blind"] = true;
    chatOptions["template"] = "systems/wfrp4e/templates/chat/round-summary.html"


    let chatData = {
      title: "Round " + combat.current.round + " Summary",
      combatants: combatantArray
    }


    return renderTemplate(chatOptions.template, chatData).then(html =>
    {
      chatOptions["user"] = game.user._id

      // Emit the HTML as a chat message
      chatOptions["content"] = html;
      chatOptions["type"] = 0;
      ChatMessage.create(chatOptions, false);
      return html;
    });
  }

  /**
   * Parses effect file paths into more readable conditions.
   * 
   * Currently, effects don't have names, just filepaths to the icon. This function sorts an array
   * of filepaths into more a more readable list.
   * 
   * Example: Token has ".../bleeding5" and ".../bleeding1", and ".../entangled5", this is turned into 
   * the array ["Bleeding 6", "Entangled 5"] and returned.
   * 
   * @param {Array} effectList List of status effects (png file paths) currently affecting the target
   */
  static parseConditions(effectList)
  {
    let conditions = {} // Object to store conditions before returning - stored as {"bleeding" : 5, "prone", true}
    effectList = effectList.map(function (effect)
    {
      // Numeric condition = Bleeding 3
      let isNumeric = !isNaN(effect[effect.lastIndexOf(".") - 1])
      // Add numeric condition to existing condition if available, otherwise, add it
      if (isNumeric)
      {
        effect = effect.substring(effect.lastIndexOf("/") + 1)
        let effectNum = effect.substring(effect.length - 5, effect.length - 4)
        effect = effect.substring(0, effect.length - 5);
        if (conditions[effect.toString()])
          conditions[effect.toString()] += parseInt(effectNum);
        else
          conditions[effect.toString()] = parseInt(effectNum);
      }
      // Non numeric condition = Prone
      else
      {
        effect = effect.substring(effect.lastIndexOf("/") + 1).substring(0, effect.length - 4);
        effect = effect.substring(0, effect.length - 4);
        conditions[effect] = true;
      }
    })

    // Turn condition object into array of neat strings
    let returnConditions = [];
    for (let c in conditions)
    {
      let displayValue = (WFRP4E.conditions[c])
      if (typeof conditions[c] !== "boolean") // Numeric condition
        displayValue += " " + conditions[c]
      returnConditions.push(displayValue);
    }

    return returnConditions;
  }

  /**
   * Posts the symptom effects, then secretly posts the treatment to the GM.
   * 
   * @param {String} symptom  symptom name to be posted
   */
  static postSymptom(symptom)
  {
    let symkey = WFRP_Utility.findKey(symptom.split("(")[0].trim(), WFRP4E.symptoms)
    let content = `<b>${symptom}</b>: ${WFRP4E.symptomDescriptions[symkey]}`;
    let chatOptions = {
      user: game.user._id,
      rollMode: game.settings.get("core", "rollMode"),
      content: content
    };
    if (["gmroll", "blindroll"].includes(chatOptions.rollMode)) chatOptions["whisper"] = ChatMessage.getWhisperIDs("GM");
    if (chatOptions.rollMode === "blindroll") chatOptions["blind"] = true;
    ChatMessage.create(chatOptions);

    if (game.user.isGM)
    {
      content = `<b>${symptom} Treatment</b>: ${WFRP4E.symptomTreatment[symkey]}`;
      chatOptions = {
        user: game.user._id,
        rollMode: game.settings.get("core", "rollMode"),
        content: content
      };
      chatOptions["whisper"] = ChatMessage.getWhisperIDs("GM");
      ChatMessage.create(chatOptions);
    }
  }

  /**
   * Posts the definition of a quality or flaw to chat.
   * 
   * @param {String} property   name of the quality or flaw
   */
  static postProperty(property)
  {
    let propertyDescription = this.propertyText(property);
    let chatOptions = {
      user: game.user._id,
      rollMode: game.settings.get("core", "rollMode"),
      content: propertyDescription
    };
    if (["gmroll", "blindroll"].includes(chatOptions.rollMode)) chatOptions["whisper"] = ChatMessage.getWhisperIDs("GM");
    if (chatOptions.rollMode === "blindroll") chatOptions["blind"] = true;
    ChatMessage.create(chatOptions);
  }

  /**
   * Helper function to easily find the property name
   * // Todo: regex?
   * @param {String} property 
   */
  static parsePropertyName(property)
  {
      property = property.trim();
      if (!isNaN(property[property.length-1]))
         return property.substring(0, property.length-2).trim()
      else
        return property;
  }

  /**
   * Helper function to set up chat data (set roll mode and content).
   * 
   * @param {String} content 
   * @param {String} modeOverride 
   * @param {Boolean} isRoll 
   */
  static chatDataSetup(content, modeOverride, isRoll = false)
  {
    let chatData = {
      user: game.user._id,
      rollMode: modeOverride || game.settings.get("core", "rollMode"),
      content: content
    };
    if (isRoll)
      chatData.sound = CONFIG.sounds.dice

    if (["gmroll", "blindroll"].includes(chatData.rollMode)) chatData["whisper"] = ChatMessage.getWhisperIDs("GM");
    if (chatData.rollMode === "blindroll") chatData["blind"] = true;
    else if (chatData.rollMode === "selfroll") chatData["whisper"] = [game.user];

    return chatData;
  }

  /**
   * Looks through object values and finds the one that most closely matches the query, returning the key.
   * 
   * Used by condition lookup.
   * 
   * @param {Object} Object Object being searched in
   * @param {*} query Value trying to match
   */
  static matchClosest(object, query)
  {
    let keys = Object.keys(object)
    let match = [];
    for (let key of keys)
    {
      let percentage = 0;
      let matchCounter = 0;
      for (let i = 0; i < key.length; i++)
      {
        if (key[i] == query[i])
        {
          matchCounter++;
        }
      }
      percentage = matchCounter / key.length;
      match.push(percentage);
    }
    let maxIndex = match.indexOf(Math.max.apply(Math, match));
    return keys[maxIndex]
  }

  /**
   * Returns token speaker if available, otherwise, returns actor.
   * 
   * @param {Object} speaker  speaker object containing actor and otken
   */
  static getSpeaker(speaker)
  {
    let actor = game.actors.get(speaker.actor);
    if (speaker.token)
      actor = canvas.tokens.get(speaker.token).actor
    return actor
  }

  /**
   * Returns all basic skills from the skills compendium
   */
  static async allBasicSkills()
  {
    let returnSkills = [];

    const pack = game.packs.find(p => p.collection == "wfrp4e.skills")
    let skills = [];
    await pack.getIndex().then(index => skills = index);
    for (let sk of skills)
    {
      let skillItem = undefined;
      await pack.getEntity(sk._id).then(skill => skillItem = skill);
      if (skillItem.data.data.advanced.value == "bsc")
      {
        if (skillItem.data.data.grouped.value != "noSpec")
        {
          let startParen = skillItem.data.name.indexOf("(")
          skillItem.data.name = skillItem.data.name.substring(0, startParen).trim();
          if (returnSkills.filter(x => x.name.includes(skillItem.name)).length <= 0)
            returnSkills.push(skillItem.data);
        }
        else
          returnSkills.push(skillItem.data)
      }
    }
    return returnSkills;
  }

  /**
   * Returns Gold Crown, Silver Shilling, and Brass Penny from trappings compendium TODO: Maybe should just do all money items in all item compendiums using the tag
   */
  static async allMoneyItems()
  {
    let moneyItems = []
    const trappings = game.packs.find(p => p.collection == "wfrp4e.trappings")
    let trappingsIndex = [];
    await trappings.getIndex().then(index => trappingsIndex = index);

    let money = trappingsIndex.filter(t => t.name.toLowerCase() == game.i18n.localize("NAME.GC").toLowerCase() || t.name.toLowerCase() == game.i18n.localize("NAME.SS").toLowerCase() || t.name.toLowerCase() == game.i18n.localize("NAME.BP").toLowerCase())

    for (let m of money)
    {
      let moneyItem = await trappings.getEntity(m._id);
      moneyItems.push(moneyItem.data);
    }
    return moneyItems
  }

  /**
   * Converts custom entity to clickable html element.
   * 
   * @param {String} match Entire string being converted (@Roll["1d8"])
   * @param {String} entityType Custom entity type - Roll, Table, etc
   * @param {String} id Input given in the custom link "1d8" above
   * @param {String} name Name given @Table["minormis"]{name}
   */
  static _replaceCustomLink(match, entityType, id, name)
  {
    switch (entityType)
    {
      case "Roll":
        return `<a class="chat-roll" data-roll="${id}"><i class='fas fa-dice'></i> ${name ? name : id}</a>`
      case "Table":
        return `<a class = "table-click" data-table="${id}"><i class="fas fa-list"></i> ${(WFRP_Tables[id] && !name) ? WFRP_Tables[id].name : name}</a>`
      case "Symptom":
        return `<a class = "symptom-tag" data-symptom="${id}"><i class='fas fa-user-injured'></i> ${name ? name : id}</a>`
      case "Condition":
        return `<a class = "condition-chat" data-cond="${id}"><i class='fas fa-user-injured'></i> ${name ? name : id}</a>`
      case "Pay":
        return `<a class = "pay-link" data-pay="${id}"><i class="fas fa-coins"></i> ${name ? name : id}</a>`
    }
  }

  /**
   * Collects data from the table click event and sends it to WFRP_Tables to be rolled.
   * 
   * @param {Object} event  click event
   */
  static handleTableClick(event)
  {
    let modifier = parseInt($(event.currentTarget).attr("data-modifier")) || 0;
    let html;
    let chatOptions = this.chatDataSetup("", game.settings.get("core", "rollMode"))
    if (event.target.text)
      event.target.text = event.target.text.trim();
    if (event.button == 0)
    {
      if (event.target.text.trim() == game.i18n.localize("ROLL.CritCast"))
      {
        html = WFRP_Tables.criticalCastMenu($(event.currentTarget).attr("data-table"));
      }

      else if (event.target.text.trim() == game.i18n.localize("ROLL.CritChannel"))
      {
        html = "<b>Critical Casting</b>: You automatically channel up to the spell's CN, and if you successfully cast the spell next turn, you add +SL equal to the CN of the spell (this SL cannot be used for overcasting)"
      }

      else if (event.target.text.trim() == game.i18n.localize("ROLL.TotalPower"))
        html = WFRP_Tables.restrictedCriticalCastMenu();

      // Not really a table but whatever
      else if ($(event.currentTarget).attr("data-table") == "misfire")
      {
        let damage = $(event.currentTarget).attr("data-damage")
        html = game.i18n.format("ROLL.Misfire", {damage : damage});
      }
      else
        html = WFRP_Tables.formatChatRoll($(event.currentTarget).attr("data-table"),
        {
          modifier: modifier
        }, $(event.currentTarget).attr("data-column"));

      chatOptions["content"] = html;
      chatOptions["type"] = 0;
      ChatMessage.create(chatOptions);

    }

    // If right click, open table modifier menu
    else if (event.button == 2)
    {
      renderTemplate('systems/wfrp4e/templates/chat/table-dialog.html').then(html =>
      {
        new Dialog(
        {
          title: "Table Modifier",
          content: html,
          buttons:
          {
            roll:
            {
              label: game.i18n.localize("Roll"),
              callback: (html) =>
              {
                let tableModifier = html.find('[name="tableModifier"]').val();
                let tableLookup = html.find('[name="tableLookup"]').val();
                let minOne = html.find('[name="minOne"]').is(':checked');
                html = WFRP_Tables.formatChatRoll($(event.currentTarget).attr("data-table"),
                {
                  modifier: tableModifier,
                  minOne: minOne,
                  lookup: Number(tableLookup)
                });
                chatOptions["content"] = html;
                chatOptions["type"] = 0;
                ChatMessage.create(chatOptions);
              }
            },
          },
          default: 'roll'
        }).render(true);
      })
    }
  }

  /**
   * Post condition when clicked.
   * 
   * @param {Object} event click event
   */
  static handleConditionClick(event)
  {
    let cond = $(event.currentTarget).attr("data-cond")
    if (!cond)
      cond = event.target.text.trim();
    cond = cond.split(" ")[0]
    let condkey = WFRP_Utility.findKey(cond, WFRP4E.conditions);
    let condDescr = WFRP4E.conditionDescriptions[condkey];
    let messageContent = `<b>${cond}</b><br>${condDescr}`

    let chatData = WFRP_Utility.chatDataSetup(messageContent)
    ChatMessage.create(chatData);
  }

  /**
   * Post symptom when clicked
   * 
   * @param {Object} event click event
   */
  static handleSymptomClick(event)
  {
    let symptom = $(event.currentTarget).attr("data-symptom")
    if (!symptom)
      symptom = event.target.text;
    WFRP_Utility.postSymptom(symptom)
  }

  /**
   * Roll to chat when roll entity is clicked
   * 
   * @param {Object} event clicke event
   */
  static handleRollClick(event)
  {
    let roll = $(event.currentTarget).attr("data-roll")
    if (!roll)
      roll = event.target.text.trim();
    let rollMode = game.settings.get("core", "rollMode");
    new Roll(roll).roll().toMessage(
    {
      user: game.user._id,
      rollMode
    })
  }


    /**
   * Handle a payment entity link
   * 
   * @param {Object} event clicke event
   */
  static handlePayClick(event)
  {
    let payString = $(event.currentTarget).attr("data-pay")
    if (game.user.isGM)
      MarketWfrp4e.generatePayCard(payString);
  }

  /**
   * Retrieves the item being requested by the macro from the selected actor,
   * sending it to the correct setup____ function to be rolled.
   * 
   * @param {String} itemName name of item being rolled
   * @param {String} itemType type of item ("weapon", "spell", etc)
   */
  static rollItemMacro(itemName, itemType, bypassData)
  {
    const speaker = ChatMessage.getSpeaker();
    let actor;
    if (speaker.token) actor = game.actors.tokens[speaker.token];
    if (!actor) actor = game.actors.get(speaker.actor);
    let item
    // Not technically an item, used for convenience
    if (itemType == "characteristic")
    {
      return actor.setupCharacteristic(itemName, bypassData)
    }
    else
    {
      item = actor ? actor.items.find(i => i.name === itemName && i.type == itemType) : null;
    }
    if (!item) return ui.notifications.warn(`${game.i18n.localize("Error.MacroItemMissing")} ${itemName}`);

    item = item.data;

    // Trigger the item roll
    switch (item.type)
    {
      case "weapon":
        return actor.setupWeapon(item, bypassData)
      case "spell":
        return actor.spellDialog(item, bypassData)
      case "prayer":
        return actor.setupPrayer(item, bypassData)
      case "trait":
        return actor.setupTrait(item, bypassData)
      case "skill":
        return actor.setupSkill(item, bypassData)
    }
  }

  static async toggleMorrslieb()
  {
    console.log("toggleMorrslieb()")
    let morrsliebActive = canvas.scene.getFlag("wfrp4e", "morrslieb")
    morrsliebActive = !morrsliebActive
    await canvas.scene.setFlag("wfrp4e", "morrslieb", morrsliebActive)

    if (game.modules.get("fxmaster") && game.modules.get("fxmaster").active)
    {
      let filters = canvas.scene.getFlag('fxmaster', 'filters')
      if (!filters) filters = {};
      if (morrsliebActive)
      {
        filters["morrslieb"] = {
          type: "color",
          options: {
            red: CONFIG.Morrslieb.red,
            green: CONFIG.Morrslieb.green,
            blue: CONFIG.Morrslieb.blue
            }
          }
        }
        else 
        {
          filters["morrslieb"] = {
            type: "color",
            options: {
              red: 1,
              green: 1,
              blue: 1
              }
            }
        }
        canvas.scene.setFlag('fxmaster', 'filters', null).then(()=> {
          canvas.scene.setFlag('fxmaster', 'filters', filters);
        })

      }
      else 
      {
        game.socket.emit("system.wfrp4e", {
          type : "morrslieb"
        })
        canvas.draw();
      }
    }
  }