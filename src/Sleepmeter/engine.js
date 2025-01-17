/*
 * Copyright 2020-2022 Sleepdiary Developers <sleepdiary@pileofstuff.org>
 *
 * Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without
 * restriction, including without limitation the rights to use, copy,
 * modify, merge, publish, distribute, sublicense, and/or sell copies
 * of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS
 * BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
 * ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

"use strict";

/**
 * @public
 * @unrestricted
 * @augments DiaryBase
 *
 * @example
 * let diary = new_sleep_diary(contents_of_my_file));
 *
 * console.log( diary.custom_aids );
 * -> [
 *      { "custom_aid_id": "CUSTOM_0001", "class": "READING", "name": "The Cat in the Hat" },
 *      ...
 *    ]
 *
 * console.log( diary.custom_hindrances );
 * -> [
 *      { "custom_hindrance_id": "CUSTOM_0001", "class": "OBLIGATION", "name": "Appointment" },
 *      ...
 *    ]
 *
 * console.log( diary.custom_tags );
 * -> [
 *      { "custom_tag_id": "CUSTOM_0001", "name": "ate cheese before bed" },
 *      ...
 *    ]
 *
 * // Print the complete list of records
 * console.log(diary.records);
 * -> [
 *      {
 *
 *        // normalised event times - use these where possible:
 *        "start" : 12345678, // based on "bedtime"
 *        "end" : 23456789, // based on "wake"
 *        "duration" : 11111111, // "wake" minus "sleep" and minus "holes"
 *
 *        "wake" : {
 *          "string": "2001-02-03 04:05+0600",
 *          "year"  : 2001,
 *          "month" : 2,
 *          "day"   : 3,
 *          "hour"  : 4,
 *          "minute": 5,
 *          "offset": 6
 *        },
 *        "sleep" : {
 *          "string": "2001-02-03 04:04+0600",
 *          "year"  : 2001,
 *          "month" : 2,
 *          "day"   : 3,
 *          "hour"  : 4,
 *          "minute": 4,
 *          "offset": 6
 *        },
 *        "bedtime" : {
 *          "string": "2001-02-03 04:00+0600",
 *          "year"  : 2001,
 *          "month" : 2,
 *          "day"   : 3,
 *          "hour"  : 4,
 *          "minute": 0,
 *          "offset": 6
 *        },
 *        "holes" : [ { "wake": 0, "sleep": 1 } ],
 *        "type" : "NAP",
 *        "dreams" : [
 *          { "type": "GOOD", "mood": 5, "themes": [ "PRECOGNITIVE", "LUCID" ] }
 *        ],
 *        "aids" : [ "CPAP", "CUSTOM_0001" ],
 *        "hindrances" : [ "ALARM_CLOCK", "CUSTOM_0001" ],
 *        "tags" : [ "OUT_OF_TOWN", "CUSTOM_0001" ],
 *        "quality" : 5,
 *        "notes" : "sleep notes"
 *      },
 *      ...
 *    ]
 *
 */
class DiarySleepmeter extends DiaryBase {

    /**
     * @param {Object} file - file contents
     * @param {Function=} serialiser - function to serialise output
     */
    constructor(file,serialiser) {

        super(file,serialiser); // call the SleepDiary constructor

        /*
         * Several parts of the file format have a list of valid values.
         * This section defines regular expressions for each of those.
         */

        const sleep_aid_list = [
            "ALCOHOL",
            "AMBIEN",
            "AMBIEN_CR",
            "AROMATHERAPY",
            "BENADRYL",
            "CHAMOMILE",
            "CIRCADIN",
            "CPAP",
            "DOZILE",
            "EAR_PLUGS",
            "EXERCISE",
            "GABA",
            "IMOVANE",
            "LUNESTA",
            "MAGNESIUM",
            "MARIJUANA",
            "MEDITATION",
            "MELATONIN",
            "MILK",
            "MUSIC",
            "NYQUIL",
            "READING",
            "RESTAVIT",
            "ROZEREM",
            "SEX",
            "SOUND_MACHINE",
            "ST_JOHNS_WORT",
            "TV",
            "TYLENOL",
            "TYLENOL_PM",
            "UNISOM",
            "UNISOM2",
            "VALERIAN",
            "ZIMOVANE"
        ];

        const sleep_hindrance_list = [
            "ALARM_CLOCK",
            "ANGER",
            "ANXIETY",
            "ARGUMENT",
            "BABY_CRYING",
            "BATHROOM_BREAK",
            "TOO_BRIGHT",
            "BUNKMATE_SNORING",
            "CAFFEINE",
            "TOO_COLD",
            "DOG_BARKING",
            "FIRE_ANTS",
            "HEARTBURN",
            "TOO_HOT",
            "HUNGER",
            "LOUD_NEIGHBOR",
            "MIND_RACING",
            "PAIN",
            "PHONE_RANG",
            "RESTLESS_LEGS",
            "SCARY_MOVIE",
            "SICK",
            "SQUIRRELS_ON_ROOF",
            "STORM",
            "STRESS",
            "SUGAR",
            "VIDEO_GAME",
            "WIND"
        ];

        const sleep_tag_list = [
            "ALONE",
            "BUNKMATE",
            "CAMPING",
            "COUCH",
            "GOING_FISHING",
            "HOTEL",
            "OUT_OF_TOWN",
            "PASSED_OUT_DRUNK",
            "SCHOOL_NIGHT",
            "SLEEP_TALKING",
            "SLEEP_WALKING",
            "SLEPT_AT_FRIENDS_PLACE",
            "SLEPT_IN_CAR",
            "WORK_NIGHT"
        ];

        const custom = "CUSTOM_[0-9]*";

        const sleep_aid       = sleep_aid_list      .join('|') + "|" + custom;
        const sleep_hindrance = sleep_hindrance_list.join('|') + "|" + custom;
        const sleep_tag       = sleep_tag_list      .join('|') + "|" + custom;
        var sleep_tag_map = {};
        [ sleep_aid_list, sleep_hindrance_list, sleep_tag_list ].forEach(
            (list,n) => list.forEach( tag => sleep_tag_map[tag] = n )
        );

        const sleep_aid_class =
               "AIRWAY" +
              "|BEVERAGE" +
              "|DRUG" +
              "|EXERTION" +
              "|HERBAL" +
              "|READING" +
              "|RELAXATION" +
              "|SENSORY_DEPRIVATION" +
              "|SOUND"
        ;
        const sleep_hindrance_class =
               "ENVIRONMENTAL" +
              "|MENTAL" +
              "|NOISE" +
              "|OBLIGATION" +
              "|PHYSICAL" +
              "|STIMULANT"
        ;

        const sleep_type =
               "NIGHT_SLEEP" +
              "|NAP"
        ;
        const dream_type =
               "UNKNOWN" +
              "|GOOD" +
              "|EROTIC" +
              "|NEUTRAL" +
              "|STRANGE" +
              "|CREEPY" +
              "|TROUBLING" +
              "|NIGHTMARE"
        ;
        const dream_theme =
               "CHASE" +
              "|COMPENSATORY" +
              "|DAILY_LIFE" +
              "|DEATH" +
              "|EPIC" +
              "|FALLING" +
              "|FALSE_AWAKENING" +
              "|FLYING" +
              "|LUCID" +
              "|MURDER" +
              "|MUTUAL" +
              "|NAKED_IN_PUBLIC" +
              "|ORGASMIC" +
              "|PHYSIOLOGICAL" +
              "|PRECOGNITIVE" +
              "|PROGRESSIVE" +
              "|RECURRING" +
              "|RELIGIOUS" +
              "|SIGNAL" +
              "|TEETH" +
              "|TEST" +
              "|MONEY"
        ;


        /*
         * Some parts of the file format have a slightly more complex stricture.
         * This section defines regular expressions for each of those.
         */
        // DateTimes are of the form "yyyy-MM-dd hh:mm+ZZZ" (with quotes)
        const datetime_type =
              "\"" +
              "([0-9][0-9]*)-([0-9][0-9]?)-([0-9][0-9]?) " +
              "([0-9][0-9]?):([0-9][0-9])?" +
              "([-+])([0-9][0-9]*)([0-9][0-9])" +
              "\""
        ;
        // any integer greater than zero:
        const positive_integer = "[1-9][0-9]*";
        // any integer in the range 0..10 (inclusive):
        const zero_to_ten = "[0-9]|10";
        // any integer in the range -5..5 (inclusive):
        const negative_five_to_five = "-[1-5]|[0-5]";
        // a quoted string:
        const free_text = "\"(.|\n)*\"";

        /*
         * Fields in a single record
         */

        const custom_field = custom;
        const sleep_aid_class_field = sleep_aid_class;
        const sleep_hindrance_class_field = sleep_hindrance_class;
        const name_field = free_text;

        const wake_field    = datetime_type;
        const sleep_field   = datetime_type;
        const bedtime_field = datetime_type;

        const holes_field = "|" +
              "("     + positive_integer + ")-(" + positive_integer + ")" +
              "(\\|(" + positive_integer + ")-(" + positive_integer + "))*"
        ;

        const type_field = sleep_type;

        const dream = "(" + dream_type + "):(" + negative_five_to_five + ")(:(" + dream_theme + "))*";
        const dreams_field = "NONE|" +
              "("     + dream + ")" +
              "(\\|(" + dream + "))*";

        const aids_field    = "NONE|" +
              "("     + sleep_aid + ")" +
              "(\\|(" + sleep_aid + "))*";

        const hindrances_field = "NONE|" +
              "("     + sleep_hindrance + ")" +
              "(\\|(" + sleep_hindrance + "))*";

        const tags_field = "NONE|" +
              "("     + sleep_tag + ")" +
              "(\\|(" + sleep_tag + "))*";

        const quality_field = zero_to_ten;

        const notes_field = free_text;


        /*
         * Complete records
         */

        const custom_aid =
              "^(" +          custom_field + ")," +
               "(" + sleep_aid_class_field + ")," +
               "(" +            name_field + ")$"
        ;

        const custom_hindrance =
              "^(" +                custom_field + ")," +
               "(" + sleep_hindrance_class_field + ")," +
               "(" +                  name_field + ")$"
        ;

        const custom_tag =
              "^(" + custom_field + ")," +
               "(" +   name_field + ")$"
        ;

        const diary_entry =
              "^(" +       wake_field + ")," +
               "(" +      sleep_field + ")," +
               "(" +    bedtime_field + ")," +
               "(" +      holes_field + ")," +
               "(" +       type_field + ")," +
               "(" +     dreams_field + ")," +
               "(" +       aids_field + ")," +
               "(" + hindrances_field + ")," +
               "(" +       tags_field + ")," +
               "(" +    quality_field + ")," +
               "(" +      notes_field + ")$"
        ;


        /*
         * Section headers
         */

        const custom_aid_section_header = "custom_aid_id,class,name";
        const custom_hindrance_section_header = "custom_hindrance_id,class,name";
        const custom_tag_section_header = "custom_tag_id,name";
        const diary_section_header = "wake,sleep,bedtime,holes,type,dreams,aid,hindrances,tags,quality,notes";


        /*
         * Compiled regular expressions
         */

        const custom_re = new RegExp("^" + custom + "$");

        const custom_aid_re       = new RegExp(custom_aid);
        const custom_hindrance_re = new RegExp(custom_hindrance);
        const custom_tag_re       = new RegExp(custom_tag);
        const diary_entry_re      = new RegExp(diary_entry);

        const datetime_type_re = new RegExp(datetime_type);

        /*
         * Parsers for individual data types
         */

        function parse_free_text(string) {
            return string.substr( 1, string.length-2 );
        }

        function parse_time(string) {
            return new Date( string.substr( 1, string.length-2 ) ).getTime();
        }

        function parse_datetime(string) {
            let data = string.match(datetime_type_re);
            return {
                "string"   : string,
                "year"     : parseInt(data[1],10),
                "month"    : parseInt(data[2],10),
                "day"      : parseInt(data[3],10),
                "hour"     : parseInt(data[4],10),
                "minute"   : parseInt(data[5],10),
                "offset"   : (
                    (data[6]=='-'?-1:1) * (
                      parseInt(data[7],10) * 60 +
                      parseInt(data[8],10)
                    )
                ),

            };
        }

        function parse_timestamp(timestamp,timezone) {
            const date = DiaryBase.date(timestamp,timezone),
                  offset = date.offset()
            ;
            return {
                "string": (
                    '"' +
                        date["year"]() +
                        '-' +
                        DiaryBase.zero_pad( date["month"]() ) +
                        '-' +
                        DiaryBase.zero_pad( date["day"  ] () ) +
                        ' ' +
                        DiaryBase.zero_pad( date["hour"]() ) +
                        ':' +
                        DiaryBase.zero_pad( date["minute"]() ) +
                        ( offset < 0 ? '-' : '+' ) +
                        DiaryBase.zero_pad(Math.abs(Math.round(offset/60))) +
                        DiaryBase.zero_pad(Math.abs(           offset%60 )) +
                        '"'
                ),
                "year"     : date["year"](),
                "month"    : date["month"](),
                "day"      : date["day"](),
                "hour"     : date["hour"](),
                "minute"   : date["minute"](),
                "offset"   : offset,
            };
        }

        function date_to_timestamp(date,offset) {
            const offset_hours   = Math.floor(offset/60),
                  offset_minutes = Math.floor(offset%60)
            ;
            date = new Date(
                ( date["getTime"] ? date["getTime"]() : date )
                + ((offset_hours*60)+offset_minutes)*60*1000
            );
            return {
                "string": (
                    '"' +
                        date["getUTCFullYear"]() +
                        '-' +
                        DiaryBase.zero_pad( date["getUTCMonth"]()+1 ) +
                        '-' +
                        DiaryBase.zero_pad( date["getUTCDate" ] () ) +
                        ' ' +
                        DiaryBase.zero_pad( date["getUTCHours"]() ) +
                        ':' +
                        DiaryBase.zero_pad( date["getUTCMinutes"]() ) +
                        ( offset[0] == '-' ? '' : '+' ) +
                        DiaryBase.zero_pad(Math.floor(offset/60),2) +
                        DiaryBase.zero_pad(Math.floor(offset%60),2) +
                    '"'
                ),
                "year"     : date["getUTCFullYear"](),
                "month"    : date["getUTCMonth"   ]()+1,
                "day"      : date["getUTCDate"    ](),
                "hour"     : date["getUTCHours"   ](),
                "minute"   : date["getUTCMinutes" ](),
                "offset"   : offset,
            };
        }

        function parse_holes(string) {
            let ret = [];
            if ( string != "" ) {
                let sub_records = string.split('|');
                for ( let n=0; n!=sub_records.length; ++n ) {
                    let sub_sub_records = sub_records[n].split('-');
                    ret.push({
                        "wake" : parseInt(sub_sub_records[0],10),
                        "sleep": parseInt(sub_sub_records[1],10),
                    });
                }
            }
            return ret;
        }

        function parse_dreams(string) {
            let ret = [];
            if ( string.length && string != "NONE" ) {
                let sub_records = string.split('|');
                for ( let n=0; n!=sub_records.length; ++n ) {
                    let sub_sub_records = sub_records[n].split(':');
                    ret.push({
                        "type"  :          sub_sub_records[0],
                        "mood"  : parseInt(sub_sub_records[1],10),
                        "themes":          sub_sub_records.slice(2),
                    });
                }
            }
            return ret;
        }

        function parse_list(string) {
            if ( !string.length || string == "NONE" ) {
                return [];
            } else {
                return string.split('|');
            }
        }

        function parse_quality(string) {
            return parseInt(string,10);
        }

        /*
         * Parsers for complete records
         */

        function parse_custom_aid( record ) {
            let data = record.match(custom_aid_re);
            return {
                "custom_aid_id":                 data[1] ,
                "class"        :                 data[2] ,
                "name"         : parse_free_text(data[3]),
            };
        }

        function parse_custom_hindrance( record ) {
            let data = record.match(custom_hindrance_re);
            return {
                "custom_hindrance_id":                 data[1] ,
                "class"              :                 data[2] ,
                "name"               : parse_free_text(data[3]),
            };
        }

        function parse_custom_tag( record ) {
            let data = record.match(custom_tag_re);
            return {
                "custom_tag_id":                 data[1] ,
                "name"         : parse_free_text(data[2]),
            };
        }

        function parse_diary_entry( record ) {
            // parse records:
            let match = record.match(diary_entry_re),
                holes = parse_holes(match[28])
            ;
            return {
                "start"     : parse_time( match[19] ),
                "end"       : parse_time( match[ 1] ),
                "duration"  : holes.reduce(
                    (prev,hole) => prev + hole["sleep"] - hole["wake"],
                    parse_time( match[ 1] ) -
                    parse_time( match[10] )
                ),
                "wake"      : parse_datetime  (match[ 1]),
                "sleep"     : parse_datetime  (match[10]),
                "bedtime"   : parse_datetime  (match[19]),
                "holes"     : holes,
                "type"      :                  match[34] ,
                "dreams"    : parse_dreams    (match[35]),
                "aids"      : parse_list      (match[47]),
                "hindrances": parse_list      (match[51]),
                "tags"      : parse_list      (match[55]),
                "quality"   : parse_quality   (match[59]),
                "notes"     : parse_free_text (match[60]),
            };
        }

        /*
         * Split a document into sections, and the sections into records.
         *
         * We just parse the records to strings at this stage,
         * so it's easier to manage multi-line strings.
         */
        function parse_sections(text) {

            let expect_header = true,
                current_list,
                current_re,
                ret = {
                    custom_aids: [],
                    custom_hindrances: [],
                    custom_tags: [],
                    records: []
                }
            ;

            /*
             * we mainly process the document one line at a time,
             * but occasionally we need to merge lines together.
             */
            let lines = text.split("\n");
            for ( let n=0; n!=lines.length; ++n ) {

                let line = lines[n];

                if ( expect_header ) {

                    /*
                     * This line is probably a header,
                     * but could just be a weird multi-line string
                     */

                    switch ( line ) {
                    case custom_aid_section_header:
                        current_list = ret.custom_aids;
                        current_re = custom_aid_re;
                        break;
                    case custom_hindrance_section_header:
                        current_list = ret.custom_hindrances;
                        current_re = custom_hindrance_re;
                        break;
                    case custom_tag_section_header:
                        current_list = ret.custom_tags;
                        current_re = custom_tag_re;
                        break;
                    case diary_section_header:
                        current_list = ret.records;
                        current_re = diary_entry_re;
                        break;
                    default:
                        if ( current_list ) {
                            /*
                             * the previous line was blank, but this is
                             * not a header.  We assume this must be part
                             * of a strange multi-line string.
                             */
                            current_list[current_list.length-1] += "\n";
                            --n;
                        } else {
                            return this.corrupt(file);
                        }
                    }
                    expect_header = false;

                } else if ( lines[n] == "" ) {

                    /*
                     * This line looks like a section footer,
                     * but could just be a weird multi-line string
                     */

                    expect_header = true;

                } else {

                    /*
                     * This line is (part of) a record
                     */

                    while ( line.substr(line.length-1) != '"' ) {
                        /*
                         * Lines that do not end in a quote must be part
                         * of a multi-line string
                         */
                        if ( ++n == lines.length ) {
                            return this.corrupt(file);
                        }
                        line += "\n" + lines[n];
                    }

                    if ( current_re.test(line) ) {
                        // this is probably a complete record
                        current_list.push(line);
                    } else if ( current_list.length ) {
                        // the previous line actually ended with a multi-line string:
                        current_list[current_list.length-1] += "\n" + line;
                    } else {
                        return this.corrupt(file);
                    }

                }

            }

            return ret;

        }

        /**
         * Spreadsheet manager
         * @protected
         * @type {Spreadsheet}
         */
        this["spreadsheet"] = new Spreadsheet(this,[
            {
                "sheet"  : "Records",
                "member" : "records",
                "cells": [

                    {
                        "members": [ "start", "start_offset" ],
                        "formats": [ "time", null ],
                        "export": (array_element,row,offset) => {
                            row[offset  ] = Spreadsheet.create_cell( new Date( array_element["start"] ) );
                            row[offset+1] = Spreadsheet.create_cell( array_element["bedtime"]["offset"] );
                            return true;
                        },
                        "import": (array_element,row,offset) => {
                            array_element["start"] = row[offset]["value"].getTime();
                            return array_element["bedtime"] = date_to_timestamp(
                                row[offset  ]["value"],
                                row[offset+1]["value"],
                            )
                        },
                    },
                    {
                        "members": [ "end", "end_offset" ],
                        "formats": [ "time", null ],
                        "export": (array_element,row,offset) => {
                            row[offset  ] = Spreadsheet.create_cell( new Date( array_element["end"] ) );
                            row[offset+1] = Spreadsheet.create_cell( array_element["wake"]["offset"] );
                            return true;
                        },
                        "import": (array_element,row,offset) => {
                            array_element["end"] = row[offset]["value"].getTime();
                            return array_element["wake"] = date_to_timestamp(
                                row[offset  ]["value"],
                                row[offset+1]["value"],
                            );
                        },
                    },
                    {
                        "member": "duration",
                        "type"  : "duration",
                    },
                    {
                        "members": [ "sleep", "sleep_offset" ],
                        "formats": [ "time", null ],
                        "export": (array_element,row,offset) => {
                            row[offset  ] = Spreadsheet.create_cell( new Date( array_element["sleep"]["string"].substr( 1, array_element["sleep"]["string"].length-2 ) ) );
                            row[offset+1] = Spreadsheet.create_cell( array_element["sleep"]["offset"] );
                            return true;
                        },
                        "import": (array_element,row,offset) =>
                            array_element["sleep"] = date_to_timestamp(
                                row[offset  ]["value"],
                                row[offset+1]["value"]
                            ),
                    },
                    {
                        "members": [ "holes" ],
                        "regexp" : /^([0-9]*-[0-9]*(\|[0-9]*-[0-9]*)*)?$/,
                        "export": (array_element,row,offset) => {
                            row[offset] = Spreadsheet.create_cell( array_element["holes"].map( hole => hole["wake"]+'-'+hole["sleep"] ).join('|') );
                            return true;
                        },
                        "import": (array_element,row,offset) => {
                            array_element["holes"] = parse_holes(row[offset]["value"]);
                            return true;
                        },
                    },
                    {
                        "member": "type",
                        "regexp": /^(NIGHT_SLEEP|NAP)$/,
                    },
                    {
                        "members": [ "dreams" ],
                        "export": (array_element,row,offset) => {
                            row[offset] = Spreadsheet.create_cell(
                                array_element["dreams"]
                                    .map(
                                        dream => [ dream["type"], dream["mood"] ].concat(dream["themes"]).join(':')
                                    ).join('|')
                            );
                            return true;
                        },
                        "import": (array_element,row,offset) => array_element["dreams"] = parse_dreams(row[offset]["value"]),
                    },
                    {
                        "members": [ "aids" ],
                        "export": (array_element,row,offset) => {
                            row[offset] = Spreadsheet.create_cell( array_element["aids"].join("|") )
                            return true;
                        },
                        "import": (array_element,row,offset) => {
                            array_element["aids"] = parse_list(row[offset]["value"]);
                            return true;
                        },
                    },
                    {
                        "members": [ "hindrances" ],
                        "export": (array_element,row,offset) => {
                            row[offset] = Spreadsheet.create_cell( array_element["hindrances"].join("|") );
                            return true;
                        },
                        "import": (array_element,row,offset) => {
                            array_element["hindrances"] = parse_list(row[offset]["value"]);
                            return true;
                        },
                    },
                    {
                        "members": [ "tags" ],
                        "export": (array_element,row,offset) => {
                            row[offset] = Spreadsheet.create_cell(array_element["tags"].join("|"))
                            return true;
                        },
                        "import": (array_element,row,offset) => {
                            array_element["tags"] = parse_list(row[offset]["value"]);
                            return true;
                        },
                    },
                    {
                        "member": "quality",
                        "regexp": /^[0-9]*$/,
                    },
                    {
                        "member": "notes",
                    },
                ]
            },

            {
                "sheet"  : "Custom Aids",
                "member": "custom_aids",
                "cells": [
                    {
                        "member": "custom_aid_id",
                        "regexp": custom_re,
                    },
                    {
                        "member": "class",
                        "regexp": new RegExp( "^(" + sleep_aid_class + ")$" ),
                    },
                    {
                        "member": "name",
                    },
                ],
            },

            {
                "sheet"  : "Custom Hindrances",
                "member": "custom_hindrances",
                "cells": [
                    {
                        "member": "custom_hindrance_id",
                        "regexp": custom_re,
                    },
                    {
                        "member": "class",
                        "regexp": new RegExp( "^(" + sleep_hindrance_class + ")$" ),
                    },
                    {
                        "member": "name",
                    },
                ],
            },

            {
                "sheet"  : "Custom Tags",
                "member": "custom_tags",
                "cells": [
                    {
                        "member": "custom_tag_id",
                        "regexp": custom_re,
                    },
                    {
                        "member": "name",
                    },
                ],
            },

        ]);

        let custom_aids = [],
            custom_hindrances = [],
            custom_tags = [],
            records = []
        ;

        switch ( file["file_format"]() ) {

        case "string":

            /*
             * Parse the complete document
             */

            if ( file["contents"].search(diary_section_header) == -1 ) return this.invalid(file);

            let sections = parse_sections(file["contents"]);
            custom_aids       = sections.custom_aids      .map( parse_custom_aid );
            custom_hindrances = sections.custom_hindrances.map( parse_custom_hindrance );
            custom_tags       = sections.custom_tags      .map( parse_custom_tag );
            records           = sections.records          .map( parse_diary_entry );

            break;

        default:

            if ( this.initialise_from_common_formats(file) ) return;

            let bedtimes = {};

            file["to"]("Standard")["records"].forEach(
                record => {
                    switch ( record["status"] ) {

                    case "in bed":
                        bedtimes[record["end"]] = [ record["start"], record["start_timezone"] ];
                        break;

                    case "asleep":
                        let tags = [ [], [], [] ],
                            bedtime = bedtimes[record["start"]] ||
                                [ record["start"], record["start_timezone"] ]
                        ;
                        (record["tags"]||[]).forEach(
                            tag => {
                                if ( sleep_tag_map.hasOwnProperty(tag) ) {
                                    tags[sleep_tag_map[tag]].push(tag);
                                } else {
                                    let our_tag = custom_tags.find(
                                        custom_tag => tag == custom_tag["name"]
                                    );
                                    if ( our_tag ) {
                                        tags[2].push(our_tag["custom_tag_id"]);
                                    } else {
                                        const id = "CUSTOM_" + DiaryBase.zero_pad(custom_tags.length+1,4);
                                        custom_tags.push({
                                            "custom_tag_id": id,
                                            "name"         : tag,
                                        });
                                        tags[2].push(id);
                                    }
                                }
                            }
                        );
                        records.push({
                            "start"         : bedtime[0],
                            "end"           : record["end"     ],
                            "duration"      : record["duration"],
                            "wake"          : parse_timestamp(record["end"  ],record["end_timezone"]),
                            "sleep"         : parse_timestamp(record["start"],record["start_timezone"]),
                            "bedtime"       : parse_timestamp( bedtime[0], bedtime[1] ),
                            "holes"         : [],
                            "type"          : record["is_primary_sleep"] ? "NIGHT_SLEEP" : "NAP",
                            "dreams"        : [],
                            "aids"          : tags[0],
                            "hindrances"    : tags[1],
                            "tags"          : tags[2],
                            "quality"       : 5,
                            "notes"         : (record["comments"]||[]).join('; ')
                        });
                        break;

                    }
                }
            );

            break;

        }

        /**
         * Things that aid sleep
         */
        this["custom_aids"      ] = custom_aids;

        /**
         * Things that hinder sleep
         */
        this["custom_hindrances"] = custom_hindrances;

        /**
         * Arbitrary tags describing the sleep experience
         */
        this["custom_tags"      ] = custom_tags;

        /**
         * Individual records from the sleep diary
         */
        this["records"          ] = records;

    }

    ["to"](to_format) {

        switch ( to_format ) {

        case "output":

            let contents = "";

            if ( this["custom_aids"      ].length ) {
                contents += "custom_aid_id,class,name\n";
                this["custom_aids"      ].forEach(
                    aid => contents += `${aid["custom_aid_id"]},${aid["class"]},"${aid["name"]}"\n`
                );
                contents += "\n";
            }

            if ( this["custom_hindrances"].length ) {
                contents += "custom_hindrance_id,class,name\n";
                this["custom_hindrances"].forEach(
                    hindrance => contents += `${hindrance["custom_hindrance_id"]},${hindrance["class"]},"${hindrance["name"]}"\n`
                );
                contents += "\n";
            }

            if ( this["custom_tags"].length ) {
                contents += "custom_tag_id,name\n";
                this["custom_tags"].forEach(
                    tag => contents += `${tag["custom_tag_id"]},"${tag["name"]}"\n`
                );
                contents += "\n";
            }

            contents += "wake,sleep,bedtime,holes,type,dreams,aid,hindrances,tags,quality,notes\n";

            this["records"].forEach(
                rec => contents += [
                    rec["wake"   ]["string"],
                    rec["sleep"  ]["string"],
                    rec["bedtime"]["string"],
                    rec["holes"].map( hole => `${hole["wake"]}-${hole["sleep"]}` ).join('|'),
                    rec["type"],
                    rec["dreams"].map(
                        dream => [ dream["type"], dream["mood"] ].concat(dream["themes"]).join(':')
                    ).join('|') || 'NONE',
                    rec["aids"      ].join('|') || 'NONE',
                    rec["hindrances"].join('|') || 'NONE',
                    rec["tags"      ].join('|') || 'NONE',
                    rec["quality"],
                    '"' + rec["notes"] + '"'
                ].join(',') + "\n"
            );

            return this.serialise({
                "file_format": () => "string",
                "contents": contents
            });

        case "Standard":

            let custom_aid_map = {},
                custom_hindrance_map = {},
                custom_tag_map = {},
                records = []
            ;

            this["custom_aids"].forEach(
                aid => custom_aid_map[aid["custom_aid_id"]] = aid["name"]
            );
            this["custom_hindrances"].forEach(
                hindrance => custom_hindrance_map[hindrance["custom_hindrance_id"]] = hindrance["name"]
            );
            this["custom_tags"].forEach(
                tag => custom_tag_map[tag["custom_tag_id"]] = tag["name"]
            );

            function parse_timezone( datetime ) {
                let offset = Math.round(datetime["offset"]/60);
                // Note: offsets and Etc/GMT times are reversed,
                // so negative offsets are GMT+ and positive offsets are GMT-
                if ( offset < 0 ) return "Etc/GMT+" + Math.abs(offset);
                if ( offset > 0 ) return "Etc/GMT-" +          offset ;
                                  return "Etc/GMT";
            }

            this["records"].forEach(
                record => {
                    var sleep = record["sleep"],
                        sleep_time = new Date(sleep["string"].substr(1,sleep["string"].length-2)).getTime()
                    ;
                    if ( record["start"] < sleep_time ) {
                        records.push({
                            "status"        : "in bed",
                            "start"         : record["start"],
                            "end"           : sleep_time,
                            "start_timezone": parse_timezone(record["bedtime"]),
                              "end_timezone": parse_timezone(record["sleep"]),
                        });
                    }
                    let tags = [];
                    record["aids"      ].forEach( h => tags.push( custom_aid_map      [h] || h ) );
                    record["hindrances"].forEach( h => tags.push( custom_hindrance_map[h] || h ) );
                    record["tags"      ].forEach( h => tags.push( custom_tag_map      [h] || h ) );
                    records.push(Object.assign(
                        {
                            "status"          : "asleep",
                            "start"           : (
                                ( record["start"] === undefined )
                                ? ( sleep_time || undefined )
                                : Math.max( record["start"], sleep_time )
                            ),
                            "end"             : record["end"],
                            "start_timezone"  : parse_timezone(record["sleep"]),
                              "end_timezone"  : parse_timezone(record["wake"]),
                            "tags"            : tags,
                            "comments"        : record["notes"].length ? [ record["notes"] ] : [],
                        },
                        ( record["duration"] === undefined ) ? {} : { "duration" : record["duration"] },
                        ( record["type"] == "NIGHT_SLEEP" ) ? { "is_primary_sleep": true } : {},
                    ));
                }
            );

            return new DiaryStandard({ "records": records }, this.serialiser);

        default:

            return super["to"](to_format);

        }

    }

    ["merge"](other) {

        let custom_aid_map = {},
            custom_hindrance_map = {},
            custom_tag_map = {}
        ;

        other = other["to"](this["file_format"]());

        // Map custom aid ids in the other file to equivalents in this file:
        if ( this["custom_aids"].length && other["custom_aids"].length ) {
            other["custom_aids"].forEach(
                their_aid => {
                    let our_aid = this["custom_aids"].find(
                        our_aid => (
                            our_aid["class"] == their_aid["class"] &&
                            our_aid["name" ] == their_aid["name" ]
                        )
                    );
                    if ( !our_aid ) {
                        // create a new ID, e.g. "CUSTOM_0001":
                        let id = "CUSTOM_0001";
                        for (
                            let n=2;
                            this["custom_aids"].some( aid => aid["custom_aid_id"] == id );
                            ++n
                        ) {
                            id = "CUSTOM_" + DiaryBase.zero_pad(n,4);
                        }
                        our_aid = {
                            "custom_aid_id": id,
                            "class"        : their_aid["class"],
                            "name"         : their_aid["name" ],
                        };
                        this["custom_aids"].push(our_aid);
                    }
                    custom_aid_map[their_aid["custom_aid_id"]] = our_aid["custom_aid_id"];
                }
            );
        } else {
            other["custom_aids"].forEach(
                their_aid => custom_aid_map[their_aid["custom_aid_id"]] = their_aid["custom_aid_id"]
            );
        }

        // Map custom hindrance ids in the other file to equivalents in this file:
        if ( this["custom_hindrances"].length && other["custom_hindrances"].length ) {
            other["custom_hindrances"].forEach(
                their_hindrance => {
                    let our_hindrance = this["custom_hindrances"].find(
                        our_hindrance => (
                            our_hindrance["class"] == their_hindrance["class"] &&
                            our_hindrance["name" ] == their_hindrance["name" ]
                        )
                    );
                    if ( !our_hindrance ) {
                        // create a new ID, e.g. "CUSTOM_0001":
                        let id = "CUSTOM_0001";
                        for (
                            let n=2;
                            this["custom_hindrances"].some( hindrance => hindrance["custom_hindrance_id"] == id );
                            ++n
                        ) {
                            id = "CUSTOM_" + DiaryBase.zero_pad(n,4);
                        }
                        our_hindrance = {
                            "custom_hindrance_id": id,
                            "class"              : their_hindrance["class"],
                            "name"               : their_hindrance["name" ],
                        };
                        this["custom_hindrances"].push(our_hindrance);
                    }
                    custom_hindrance_map[their_hindrance["custom_hindrance_id"]] = our_hindrance["custom_hindrance_id"];
                }
            );
        } else {
            other["custom_hindrances"].forEach(
                their_hindrance => custom_hindrance_map[their_hindrance["custom_hindrance_id"]] = their_hindrance["custom_hindrance_id"]
            );
        }

        // Map custom tag ids in the other file to equivalents in this file:
        if ( this["custom_tags"].length && other["custom_tags"].length ) {
            other["custom_tags"].forEach(
                their_tag => {
                    let our_tag = this["custom_tags"].find(
                        our_tag => our_tag["name"] == their_tag["name"]
                    );
                    if ( !our_tag ) {
                        // create a new ID, e.g. "CUSTOM_0001":
                        let id = "CUSTOM_0001";
                        for (
                            let n=2;
                            this["custom_tags"].some( tag => tag["custom_tag_id"] == id );
                            ++n
                        ) {
                            id = "CUSTOM_" + DiaryBase.zero_pad(n,4);
                        }
                        our_tag = {
                            "custom_tag_id": id,
                            "name"         : their_tag["name" ],
                        };
                        this["custom_tags"].push(our_tag);
                    }
                    custom_tag_map[their_tag["custom_tag_id"]] = our_tag["custom_tag_id"];
                }
            );
        } else {
            other["custom_tags"].forEach(
                their_tag => custom_tag_map[their_tag["custom_tag_id"]] = their_tag["custom_tag_id"]
            );
        }

        // merge records:

        this["records"] = this["records"].concat(
            DiaryBase.unique(
                this["records"],
                other["records"],
                r => [ r["wake"]["string"], r["sleep"]["string"], r["bedtime"]["string"] ].join()
            )
                .map(
                    record => Object.assign(
                        {},
                        record,
                        {
                            "aids"      : record["aids"].map( aid => custom_aid_map[aid] || aid ),
                            "hindrances": record["hindrances"].map( hindrance => custom_hindrance_map[hindrance] || hindrance ),
                            "tags"      : record["tags"].map( tag => custom_tag_map[tag] || tag ),
                        }))
        )
        .sort( (a,b) => a["wake"] - b["wake"] )
    ;

        return this;

    }

    ["file_format"]() { return "Sleepmeter"; }
    ["format_info"]() {
        return {
            "name": "Sleepmeter",
            "title": "Sleepmeter",
            "url": "/src/Sleepmeter",
            "statuses": [ "in bed", "asleep" ],
            "extension": ".csv",
            "logo": "http://www.squalllinesoftware.com/sites/squalllinesoftware.com/files/sleepmeter_logo_128x128.png",
        }
    }

}

DiaryBase.register(DiarySleepmeter);
