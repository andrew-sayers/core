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
 * console.log( this.records );
 * -> [ // "records" is an array of objects:
 *      {
 *
 *        // normalised event times - use these where possible:
 *        "start" : 12345678,
 *        "end" : 23456789,
 *        "alarm" : 23456789,
 *        "duration" : 11111111, // "Hours" hours minus "LenAdjust" minutes
 *
 *        // native event times - see README.md#date-issues
 *        "Id" : "12345678",
 *        "Tz" : "Europe/London",
 *        "From" : {
 *          "string"   : "01. 02. 2003 04:05",
 *          "year"     : 2003,
 *          "month"    : 2,
 *          "day"      : 1,
 *          "hour"     : 4,
 *          "minute"   : 5,
 *        },
 *        "To" : {
 *          "string"   : "01. 02. 2003 05:06",
 *          "year"     : 2003,
 *          "month"    : 2,
 *          "day"      : 1,
 *          "hour"     : 5,
 *          "minute"   : 6,
 *        },
 *        "Sched" : {
 *          "string"   : "01. 02. 2003 06:07",
 *          "year"     : 2003,
 *          "month"    : 2,
 *          "day"      : 1,
 *          "hour"     : 6,
 *          "minute"   : 7,
 *        },
 *        "Hours" : 1.1,
 *
 *        "Rating" : 2.5,
 *        "Comment" : {
 *          "string": "comment string with a #tag",
 *          "tags"  : [{ "count": 1, "value": "tag" }],
 *          "notags": "comment string with a"
 *        },
 *        "Framerate" : "10000",
 *        "Snore" : null,
 *        "Noise" : null,
 *        "Cycles" : null,
 *        "DeepSleep" : null,
 *        "LenAdjust" : null,
 *        "Geo" : "",
 *        "times" : [
 *          {
 *            "header_string": "04:40",
 *            "hours"        : 4,
 *            "minutes"      : 40,
 *            "actigraphy"   : 0.5,
 *            "noise"        : 10.0,
 *          },
 *          ...
 *        ],
 *        "events" : [
 *          {
 *            "label"    : "LUX",
 *            "timestamp": 123456789,
 *            "value"    : 10.0,
 *          },
 *        ]
 *      },
 *      ...
 *    ]
 *
 * console.log( this.prefs );
 * -> { key/value pairs, format not guaranteed by this library }
 *
 * console.log( this.alarms );
 * -> [ list of alarms, format not guaranteed by this library ]
 *
 */
class DiarySleepAsAndroid extends DiaryBase {

    /**
     * @param {Object} file - file contents, or filename/contents pairs (for archive files)
     * @param {Function=} serialiser - function to serialise output
     */
    constructor(file,serialiser) {

        super(file,serialiser); // call the SleepDiary constructor

        /*
         * Regular expressions for fundamental data types
         */

        const              integer_type = "\"-?[0-9]*\"";
        const non_negative_integer_type =   "\"[0-9]*\"";
        const              number_type  = "\"-?[0-9]*(\\.[0-9]*)?\"";
        const non_negative_number_type  =   "\"[0-9]*(\\.[0-9]*)?\"";

        const deep_sleep_type = "\"(-[12]\\.0|0\\.[0-9]*|1\\.0)\"";

        const geo_type = "\"[0-9a-f]*\"";

        const free_text_type = "\"([^\"]|\"\")*\"";

        const event_type = "\"([A-Z_]*)-([0-9]*)(-([-0-9E.]*))?\"";

        // e.g. "31. 01. 2010 01:23" (with quotes):
        const datetime_type = "\"([0-9]*)\\. ([0-9]*). ([0-9]*) ([0-9]*):([0-9]*)\"";

        const time_type = "\"([0-9]*):([0-9]*)\"";

        const tag_type = "#([^ \",][^ \",]*)";

        /*
         * Fields in a single record
         */

        // line 1:
        const time_header = time_type;

        // line 2:
        const identifier_field = free_text_type;
        const   timezone_field = free_text_type;
        const       from_field = datetime_type;
        const         to_field = datetime_type;
        const      sched_field = datetime_type;
        const      hours_field = non_negative_number_type;
        const     rating_field = non_negative_number_type;
        const    comment_field = free_text_type;
        const  framerate_field = free_text_type; // usually a number, but officially unspecified
        const      snore_field = integer_type;
        const      noise_field = number_type;
        const     cycles_field = integer_type;
        const deep_sleep_field = deep_sleep_type;
        const  lenadjust_field = number_type;
        const        geo_field = geo_type;
        const       time_field = number_type;
        const      event_field = event_type;

        // line 3:
        const noise_value = number_type;

        /*
         * Lines in a single record
         */

        const line_1 =
              "Id," +
              "Tz," +
              "From," +
              "To," +
              "Sched," +
              "Hours," +
              "Rating," +
              "Comment," +
              "Framerate," +
              "Snore," +
              "Noise," +
              "Cycles," +
              "DeepSleep," +
              "LenAdjust," +
              "Geo" +
              "((," + time_header + ")*)" +
              "((,\"Event\")*)"
        ;

        const line_2 =
              "(" + identifier_field + ")," +
              "(" +   timezone_field + ")," +
              "(" +       from_field + ")," +
              "(" +         to_field + ")," +
              "(" +      sched_field + ")," +
              "(" +      hours_field + ")," +
              "(" +     rating_field + ")," +
              "(" +    comment_field + ")," +
              "(" +  framerate_field + ")," +
              "(" +      snore_field + ")," +
              "(" +      noise_field + ")," +
              "(" +     cycles_field + ")," +
              "(" + deep_sleep_field + ")," +
              "(" +  lenadjust_field + ")," +
              "(" +        geo_field + ")" +
              "((," +     time_field + ")*)" +
              "((," +    event_field + ")*)"
        ;

        const line_3 = ",,,,,,,,,,,,((," + noise_value + ")*)";

        /*
         * The complete document
         */

        const document =
              "^(" +
               line_1 + "\n" +
               line_2 + "\n" +
               "(" + line_3 + "\n)?" +
              ")*" +
              "(" +
               line_1 + "\n" +
               line_2 +
               "(\n" + line_3 + ")?" +
              ")" +
              "\n?$"
        ;

        /*
         * Compiled regular expressions
         */

        const line_1_re = new RegExp("^" + line_1 + "$");
        const line_2_re = new RegExp("^" + line_2 + "$");
        const line_3_re = new RegExp("^" + line_3 + "$");

        const document_re = new RegExp(document);

        const datetime_type_re = new RegExp(   datetime_type      );
        const     time_type_re = new RegExp(       time_type, "g" );
        const   number_type_re = new RegExp(     number_type, "g" );
        const    event_type_re = new RegExp(      event_type, "g" );
        const      tag_type_re = new RegExp(        tag_type, "g" );
        const         untag_re = new RegExp( " *" + tag_type, "g" );

        const double_quote_re = new RegExp(  "\"\"", "g" );
        const      newline_re = new RegExp( " \\\\n ", "g" );

        /*
         * Parsers for individual data types
         */

        function parse_free_text(string) {
            return string.substr( 1, string.length-2 )
                .replace( double_quote_re, "\"" )
                .replace(      newline_re, "\n" )
            ;
        }

        function parse_tags(string) {
            let ret = [];
            string.replace( tag_type_re, function(_,tag) {
                if ( tag.length > 3 ) {
                    if ( tag.substr( tag.length - 3 ) == "_2x" ) {
                        ret.push({ "count": 2, "value": tag.substr( 0, tag.length - 3 ) });
                    } else if ( tag.substr( tag.length - 3 ) == "_3x" ) {
                        ret.push({ "count": 3, "value": tag.substr( 0, tag.length - 3 ) });
                    } else {
                        ret.push({ "count": 1, "value": tag });
                    }
                }
            });
            return ret;
        }

        function untag(string) {
            return string.replace( untag_re, "" );
        }

        function parse_datetime(string) {
            let data = string.match(datetime_type_re);
            return {
                "string"   : string,
                "year"     : parseInt(data[3],10),
                "month"    : parseInt(data[2],10),
                "day"      : parseInt(data[1],10),
                "hour"     : parseInt(data[4],10),
                "minute"   : parseInt(data[5],10),
            };
        }

        function parse_timestamp(timestamp,timezone) {
            const date = DiaryBase.date(timestamp,timezone);
            return {
                "string": (
                    '"' +
                        DiaryBase.zero_pad( date["day"]() ) +
                        '. ' +
                        DiaryBase.zero_pad( date["month"]() ) +
                        '. ' +
                        date["year"]() +
                        ' ' +
                        date["hour"]() + // not padded
                        ':' +
                        DiaryBase.zero_pad( date["minute"]() ) +
                    '"'
                ),
                "year"     : date["year"](),
                "month"    : date["month"](),
                "day"      : date["day"](),
                "hour"     : date["hour"](),
                "minute"   : date["minute"](),
            };
        }

        function parse_time(string) {
            let data = string.match(time_type_re);
            return {
                "string": string,
                "hour"  : parseInt(data[1],10),
                "minute": parseInt(data[2],10),
            };
        }

        function parse_integer(string) {
            return parseInt(string.substr( 1, string.length-2 ),10);
        }

        function parse_integer_nullable(string,null_values) {
            return (
                null_values.some( value => value == string )
                    ? null
                    : parse_number(string)
            );
        }

        function parse_number_nullable(string,null_values) {
            return (
                null_values.some( value => value == string )
                    ? null
                    : parse_number(string)
            );
        }

        function parse_number(string) {
            return parseFloat(string.substr( 1, string.length-2 ));
        }

        function parse_geo_nullable(string,null_values) {
            // at the time of writing, we're not sure how to interpret this value
            return (
                null_values.some( value => value == string )
                    ? null
                    : parse_free_text(string)
            );
        }

        /*
         * Parse the documents
         */

        function parse_prefs_xml(xml) {
            let ret = {},
                root = DiaryBase.parse_xml(xml).documentElement,
                longs   = Array.from(root.getElementsByTagName("long")),
                ints    = Array.from(root.getElementsByTagName("int")),
                bools   = Array.from(root.getElementsByTagName("boolean")),
                strings = Array.from(root.getElementsByTagName("string"))
            ;

            longs  .forEach( e => ret[e.getAttribute("name")] = parseInt(e.getAttribute("value"),10) );
            ints   .forEach( e => ret[e.getAttribute("name")] = parseInt(e.getAttribute("value"),10) );
            bools  .forEach( e => ret[e.getAttribute("name")] = e.getAttribute("value") == "true" );
            strings.forEach( e => ret[e.getAttribute("name")] = e.textContent );
            return ret;
        }

        function parse_alarms_json(json) {
            return JSON.parse(json);
        }

        function parse_sleep_export_csv(text) {

            let ret = [],
                lines = text.split("\n");

            if ( lines[lines.length-1] == "" ) lines.pop();

            for ( let n=0; n!=lines.length; n += 2 ) {

                /*
                 * Read the first line
                 */

                let line1_data = lines[n].match(line_1_re),
                    times = [],
                    events = []
                ;
                if ( !line1_data ) {
                    return this.corrupt(file);
                }
                // loop through the list of times, extract hours and minutes from each:
                line1_data[1].replace( time_type_re, function(str,hours,minutes) {
                    times.push({
                        "header_string": str,
                        "hours"        : parseInt(hours,10),
                        "minutes"      : parseInt(minutes,10),
                        "actigraphy"   : null,
                        "noise"        : null,
                    });
                });
                // loop through the list of events:
                line1_data[5].replace( /"Event"/g, function() {
                    events.push({
                        "label"    : null,
                        "timestamp": null,
                    });
                });

                /*
                 * Read the second line
                 */

                let line2_data = lines[n+1].match(line_2_re);

                if ( !line2_data ) {
                    return this.corrupt(file);
                }

                let current_time = 0,
                    current_event = 0,
                    comment_text = parse_free_text(line2_data[27]),
                    record = {
                        "Id"        : parse_free_text(line2_data[ 1]),
                        "Tz"        : parse_free_text(line2_data[ 3]),
                        "From"      : parse_datetime (line2_data[ 5]),
                        "To"        : parse_datetime (line2_data[11]),
                        "Sched"     : parse_datetime (line2_data[17]),
                        "Hours"     : parse_number   (line2_data[23]),
                        "Rating"    : parse_number   (line2_data[25]),
                        "Comment"   : {
                            "string":            comment_text ,
                            "tags"  : parse_tags(comment_text),
                            "notags": untag     (comment_text),
                        },
                        "Framerate" : parse_free_text       (line2_data[29]),
                        "Snore"     : parse_integer_nullable(line2_data[31], ["\"-1\""]),
                        "Noise"     : parse_number_nullable (line2_data[32], ["\"-1.0\""]),
                        "Cycles"    : parse_integer_nullable(line2_data[34], ["\"-1\""]),
                        "DeepSleep" : parse_number_nullable (line2_data[35], ["\"-1.0\"", "\"-2.0\""]),
                        "LenAdjust" : parse_number_nullable (line2_data[37], ["\"-1.0\""]),
                        "Geo"       : parse_geo_nullable    (line2_data[39], [""]),
                        "times"     : times,
                        "events"    : events,
                    }
                ;

                function calc_date( date ) {
                    return DiaryBase.date(
                        [ "year", "month", "day" ].map( v => DiaryBase.zero_pad(date[v]) ).join('-') +
                        'T' +
                        [ "hour", "minute" ].map( v => DiaryBase.zero_pad(date[v]) ).join(':'),
                        record["Tz"]
                    )["unixUtcMillis"]();
                }

                record["start"   ] = parseInt(record["Id"],10);
                record["end"     ] = record["start"]+record["Hours"]*60*60*1000;
                record["duration"] = Math.round( (
                    record["Hours"]*60 + ( line2_data[37] == "-1.0" ? 0 : record["LenAdjust"] )
                ) * 60 * 1000 );
                record["alarm"] = Math.round(
                    (
                        record["end"]
                        + calc_date( record["Sched"] )
                        - calc_date( record["To"   ] )
                    ) / (60*1000)
                ) * (60*1000)
                ;

                // loop through times:
                line2_data[40].replace( number_type_re, function(str) {
                    times[current_time++].actigraphy = parse_number(str);
                });
                // loop through events:
                line2_data[43].replace( event_type_re, function(str,label,timestamp,_,value) {
                    events[current_event]["label"]     = label;
                    events[current_event]["timestamp"] = parseInt(timestamp,10);
                    if ( value ) events[current_event]["value"] = parseFloat(value);
                    ++current_event;
                });

                /*
                 * Read the third line
                 */

                let line3_data = lines[n+2] ? lines[n+2].match(line_3_re) : 0;
                if ( line3_data ) {
                    current_time = 0;
                    line3_data[1].replace( number_type_re, function(str) {
                        times[current_time++].noise = parse_number(str);
                    });
                    ++n;
                }

                ret.push(record);

            }

            return ret;

        }

        var records,
            prefs = {},
            alarms = []
        ;

        /**
         * Spreadsheet manager
         * @protected
         * @type {Spreadsheet}
         */
        this["spreadsheet"] = new Spreadsheet(this,[]);

        const contents = file["contents"];

        switch ( file["file_format"]() ) {

        case "spreadsheet":

            // Records
            if (
                 !file["sheets"].some( sheet => {

                     const cells = sheet["cells"];

                     if ( !cells.length ) return false;

                     const line1_pattern = [
                         "Id",
                         "Tz",
                         "From",
                         "To",
                         "Sched",
                         "Hours",
                         "Rating",
                         "Comment",
                         "Tags",
                         "Framerate",
                         "Snore",
                         "Noise",
                         "Cycles",
                         "DeepSleep",
                         "LenAdjust",
                         "Geo",
                     ].join();

                     records = [];

                     let line = 1, record, times, events;
                     return cells.every( row => {
                         if ( row.slice(0,16).map( cell => cell["value"] ).join() == line1_pattern ) {

                             times  = [];
                             events = [];
                             record = {
                                 "times" : times,
                                 "events": events,
                             };
                             records.push(record);
                             line = 2;
                             row.slice(16).forEach( cell => {
                                 if ( cell["value"] == "Event" ) {
                                     events.push({
                                         "label"    : null,
                                         "timestamp": null,
                                     });
                                 } else if ( typeof(cell["value"]) == "number" ) {
                                     const hour   = Math.floor( cell["value"] *     24  );
                                     const minute = Math.floor( cell["value"] * (60*24) ) % 60;
                                     times.push({
                                         "header_string": `${hour}:${DiaryBase.zero_pad(minute)}`,
                                         "hours"        : hour,
                                         "minutes"      : minute,
                                         "actigraphy"   : null,
                                         "noise"        : null,
                                     });
                                 } else {
                                     return false;
                                 }
                             });

                         } else if ( line == 2 ) {

                             line = 3;
                             [
                                 "Id",
                                 "Tz",
                                 ,
                                 ,
                                 ,
                                 "Hours",
                                 "Rating",
                                 "Comment",
                                 "Tags",
                                 "Framerate",
                                 "Snore",
                                 "Noise",
                                 "Cycles",
                                 "DeepSleep",
                                 "LenAdjust",
                                 "Geo",
                             ].forEach( (key,n) => record[key] = row[n] ? row[n]["value"] : null );

                             if ( record["Comment"] && record["Tags"] ) {
                                 record["Comment"] = {
                                     "string": record["Comment"] + " " + record["Tags"],
                                     "tags"  : parse_tags(record["Tags"]),
                                     "notags": record["Comment"],
                                 };
                             } else if ( record["Comment"] ) {
                                 record["Comment"] = {
                                     "string": record["Comment"],
                                     "tags"  : [],
                                     "notags": record["Comment"],
                                 };
                             } else if ( record["Tags"] ) {
                                 record["Comment"] = {
                                     "string": record["Tags"],
                                     "tags"  : parse_tags(record["Tags"]),
                                     "notags": "",
                                 };
                             } else {
                                 record["Comment"] = {
                                     "string": "",
                                     "tags"  : [],
                                     "notags": "",
                                 };
                             }
                             delete record["Tags"];

                             const timezone = row[1]["value"];

                             record["start"] = row[2]["value"].getTime();
                             record["From" ] = parse_timestamp( row[2]["value"].getTime(), timezone );
                             record["end"  ] = row[3]["value"].getTime();
                             record["To"   ] = parse_timestamp( row[3]["value"].getTime(), timezone );
                             record["alarm"] = row[4]["value"].getTime();
                             record["Sched"] = parse_timestamp( row[4]["value"].getTime(), timezone );
                             record["duration"] = Math.round( (
                                 record["Hours"]*60 + ( record["LenAdjust"] || 0 )
                             ) * 60 * 1000 );

                             times .forEach( (time ,n) => {
                                 if ( row[16+n] ) time["actigraphy"] = row[16+n]["value"]
                             });
                             events.forEach( (event,n) => {
                                 if ( row[16+times.length+n] ) {
                                     const parts = row[16+times.length+n]["value"].split('-');
                                     event["label"    ] = parts[0];
                                     event["timestamp"] = parts[1];
                                     if ( parts.length > 2 ) event["value"] = parts[2];
                                 }
                             });

                         } else if ( line == 3 ) {

                             line = 1;
                             times.forEach( (time ,n) => {
                                 if ( row[16+n] ) time["noise"] = row[16+n]["value"]
                             });

                         } else {

                             return false;

                         }

                         return true;

                     });

                 })

                 ||

                 !file["sheets"].some( sheet => {
                     const cells = sheet["cells"];
                     if ( !cells.length || cells[0][0]["value"] != "Alarm" ) {
                         return false;
                     }
                     alarms = cells.slice(1).map( row => JSON.parse(row[0]["value"]) );
                     return true;
                 })

                 ||

                 !file["sheets"].some( sheet => {
                     const cells = sheet["cells"];
                     if ( !cells.length || cells[0][0]["value"] != "Preferences" ) {
                         return false;
                     }
                     prefs = JSON.parse(cells[1][0]["value"]);
                     return true;
                 })

               ) {
                return this.invalid(file);
            }

            this.raw = file["spreadsheet"];
            break;

        case "string":
            if ( !document_re.test(contents) ) return this.invalid(file);
            records = parse_sleep_export_csv.call(this,contents);
            break;

        case "archive":

            if (
                contents.hasOwnProperty("sleep-export.csv") && // could be the empty string
                contents["prefs.xml"] && contents["alarms.json"] // must be truthy strings
            ) {

                records = parse_sleep_export_csv.call(this,contents["sleep-export.csv"]);
                prefs   = parse_prefs_xml            (contents["prefs.xml"]);
                alarms  = parse_alarms_json          (contents["alarms.json"]);
                break;

            } else {

                return this.invalid(file);

            }

        default:

            if ( this.initialise_from_common_formats(file) ) return;

            records =
                file["to"]("Standard")["records"]
                .filter( r => r["status"] == "asleep" )
                .map( r => ({
                    "start"     : r["start"   ],
                    "end"       : r["end"     ],
                    "duration"  : r["duration"],
                    "alarm"     : Math.round( r["end"] / (60*1000) ) * (60*1000),
                    "Id"        : (r["start"]||0).toString(),
                    "Tz"        : r["start_timezone"] || r["end_timezone"] || "Etc/GMT",
                    "From"      : parse_timestamp(r["start"], r["start_timezone"] || r["end_timezone"] ),
                    "To"        : parse_timestamp(r["end"  ], r["end_timezone"] || r["start_timezone"]),
                    "Sched"     : parse_timestamp(r["end"  ], r["end_timezone"] || r["start_timezone"]),
                    "Hours"     : ( r["end"] - r["start"] ) / (60*60*1000),
                    "Rating"    : 2.5,
                    "Comment"   : {
                        "string": (r["comments"]||[]).join("\n") + (r["tags"]||[]).map( tag => `#${tag}` ).join(' '),
                        "tags"  : (r["tags"]||[]).map( tag => ({ "count": 1, "value": tag }) ),
                        "notags": (r["comments"]||[]).join("\n")
                    },
                    "Framerate" : "10000",
                    "Snore"     : null,
                    "Noise"     : null,
                    "Cycles"    : null,
                    "DeepSleep" : null,
                    "LenAdjust" : null,
                    "Geo"       : "",
                    "times"     : [],
                    "events"    : [],
                }))
            ;

        }

        /**
         * Individual records from the sleep diary
         */
        this["records"] = records;
        /**
         * User preferences
         */
        this["prefs"  ] = prefs;
        /**
         * User alarms
         */
        this["alarms" ] = alarms;

    }

    ["to"](to_format) {

        const headers_early = [ "Id", "Tz", "From", "To", "Sched" ];
        const headers_before_comment = [ "Hours", "Rating" ];
        const headers_after_comment  = [ "Framerate", "Snore", "Noise", "Cycles", "DeepSleep", "LenAdjust", "Geo" ];

        switch ( to_format ) {

        case "output":

            function string_or_null( string, null_value ) {
                return '"' + ( string === null ? null_value : string ) + '"';
            }

            let alarms = JSON.stringify(this["alarms"]),

                prefs = "<?xml version='1.0' encoding='utf-8' standalone='yes' ?>\n<map>" +
                Object.keys(this["prefs"]).map(
                    key => {
                        let value = this["prefs"][key];
                        switch ( typeof(value) ) {
                        case "boolean":
                            return `\n\t<boolean name="${key}" value="${value}" />\n`;
                        case "number":
                            return `\n\t<${( Math.abs(value) >= 2**31 ) ? "long" : "int" } name="${key}" value="${value}" />\n`;
                        default:
                            return `\n\t<string name="${key}"><![CDATA[${value}]]></string>\n`;
                        }
                    }
                ).join("") + "\n</map>\n",

                records = this["records"].map(
                    record => (

                        // Line 1:
                        []
                            .concat(
                                headers_early,
                                headers_before_comment,
                                ["Comment"],
                                headers_after_comment,
                                record["times" ].map( time => `,"${time["header_string"]}"` ),
                                record["events"].map( event => ",\"Event\""                 ),
                            )
                            .join(',')
                            + "\n" +

                        // line 2:
                        []
                            .concat(
                                [
                                    `"${record["Id"]}"`,
                                    `"${record["Tz"]}"`,
                                ],
                                [ "start", "end", "alarm" ].map( h => {
                                    let date = DiaryBase.date(record[h],record["Tz"]);
                                    return (
                                        '"' +
                                            DiaryBase.zero_pad( date["day"]() ) +
                                            '. ' +
                                            DiaryBase.zero_pad( date["month"]() ) +
                                            '. ' +
                                            date["year"]() +
                                            ' ' +
                                            date["hour"]() + // not padded
                                            ':' +
                                            DiaryBase.zero_pad( date["minute"]() ) +
                                            '"'
                                    );
                                }),
                                headers_before_comment.map( h => `"${record[h]}"` ),
                                [

                                    '"' + record["Comment"]["string"].replace(/"/g,`""`).replace(/\n/g," \\n ") + '"',
                                    '"' + record["Framerate"] + '"',
                                    string_or_null( record["Snore"    ], "-1" ),
                                    string_or_null( record["Noise"    ], "-1.0" ),
                                    string_or_null( record["Cycles"   ], "-1" ),
                                    string_or_null( record["DeepSleep"], "-1.0" ),
                                    string_or_null( record["LenAdjust"], "-1.0" ),
                                    string_or_null( record["Geo"      ], "" ),
                                ],
                                record["times" ].map( time => `"${time["actigraphy"]}"` ),
                                record["events"].map( event => `"${event["label"]}-${event["timestamp"]}${event.hasOwnProperty("value")?'-'+event["value"]:''}"` ),
                            ).join(',')
                            + "\n" +

                        // line 3:
                        (
                            record["times"].length
                            ?
                                ",,,,,,,,,,,,," +
                                record["times"].map( time => `"${time["noise"]}"` )
                                .join(',') + "\n"
                            : ""
                        )

                    )
                ).join("")
            ;

            return this.serialise({
                "file_format": () => "archive",
                "contents": {
                    "sleep-export.csv": records,
                    "prefs.xml"       : prefs,
                    "alarms.json"     : alarms,
                }
            });

        case "Standard":

            return new DiaryStandard({
                "records": this["records"]
                    .map(
                        record => Object.assign(
                            {
                                "status"        : "asleep",
                                "start"         :  record["start"],
                                "end"           :  record["end"  ],
                                "start_timezone":  record["Tz"],
                                "end_timezone":  record["Tz"],
                                "tags"          :  record["Comment"]["tags"].map( tag => tag["value"] ),
                                "comments"      : (
                                    record["Comment"]["notags"].length
                                        ?[record["Comment"]["notags"]]
                                        :undefined
                                ),
                            },
                            ( record["duration"] === undefined ) ? {} : { "duration" :  record["duration"] },
                        )
                    )
            }, this.serialiser);

        default:

            return super["to"](to_format);

        }

    }

    ["to_async"](to_format) {

        const headers_early = [ "Id", "Tz", "From", "To", "Sched" ];
        const headers_before_comment = [ "Hours", "Rating" ];
        const headers_after_comment  = [ "Framerate", "Snore", "Noise", "Cycles", "DeepSleep", "LenAdjust", "Geo" ];

        switch ( to_format ) {

            case "spreadsheet":

            const spreadsheet = this["spreadsheet"];

            {

                const max_times = (
                    this["records"].length
                    ? Math.max.apply( 0, this["records"].map( record => record["times"].length ) )
                    : 0
                );

                const added_sheet = spreadsheet["get_sheet"](
                    "Records",
                    headers_early.concat(
                        headers_before_comment,
                        [ "Comment", "Tags", ],
                        headers_after_comment,
                    ),
                    [
                        null,
                        null,
                        "time",
                        "time",
                        "time",
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,

                    ].concat( Array(max_times).fill("duration") )
                );
                const added = added_sheet[0];
                const sheet = added_sheet[1];
                let cells = sheet["cells"];
                cells.splice(0);

                this["records"].forEach(
                    record => {

                        // this section is very similar to the equivalent loop in the "output" condition,
                        // but the details are different enough that they can't be usefully combined

                        // Line 1:
                        cells.push(
                            []
                                .concat(
                                    headers_early,
                                    headers_before_comment,
                                    [ "Comment", "Tags" ],
                                    headers_after_comment,
                                    record["times" ].map( time => ( time["hours"]*60 + time["minutes"] ) / (60*24) ),
                                    record["events"].map( event => "Event"              ),
                                )
                                .map( c => Spreadsheet.create_cell(c,"#FFEEEEEE,#FFEEEEEE") )
                        );

                        // line 2:
                        cells.push(
                            []
                                .concat(
                                    [
                                        record["Id"],
                                        record["Tz"],
                                    ],
                                    [ "start", "end", "alarm" ].map( h => new Date(record[h]) ),
                                    headers_before_comment.map( h => record[h] ),
                                    [
                                        record["Comment"]["notags"],
                                        record["Comment"][  "tags"].map(
                                            tag => `#${tag["value"]}${tag["count"]==1?"":'_'+tag["count"]+'x'}`
                                        ).join(' '),
                                        record["Framerate"],
                                        record["Snore"    ],
                                        record["Noise"    ],
                                        record["Cycles"   ],
                                        record["DeepSleep"],
                                        record["LenAdjust"],
                                        record["Geo"      ],
                                    ],
                                    record["times" ].map( time => time["actigraphy"] ),
                                    record["events"].map( event => `${event["label"]}-${event["timestamp"]}${event.hasOwnProperty("value")?'-'+event["value"]:''}` ),
                                )
                                .map( c => Spreadsheet.create_cell(c) )
                        );

                        // line 3:
                        if ( record["times"].some( time => time["noise"] ) ) {
                            cells.push(
                                [].concat(
                                    Array(13).fill(''),
                                    record["times"].map( time => time["noise"] )
                                )
                                    .map( c => Spreadsheet.create_cell(c) )
                            );
                        }

                    }
                );

                sheet["cells"] = cells;

                if ( added ) spreadsheet["sheets"].push(sheet);

            }

            {

                const added_sheet = spreadsheet["get_sheet"](
                    "Alarms",
                    [ "Alarm" ],
                    [ ""      ],
                );
                const added = added_sheet[0];
                const sheet = added_sheet[1];
                const cells = sheet["cells"];
                cells.splice(1);

                this["alarms"].forEach( alarm => cells.push([ Spreadsheet.create_cell(JSON.stringify(alarm)) ]) );
                if ( added ) spreadsheet["sheets"].push(sheet);

            }

            {

                const added_sheet = spreadsheet["get_sheet"](
                    "Preferences",
                    [ "Preferences" ],
                    [ ""            ],
                );
                const added = added_sheet[0];
                const sheet = added_sheet[1];
                const cells = sheet["cells"];
                cells.splice(1);
                cells.push([ Spreadsheet.create_cell(JSON.stringify(this["prefs"])) ]);
                if ( added ) spreadsheet["sheets"].push(sheet);

            }

            return spreadsheet["serialise"]();

        default:

            return super["to_async"](to_format);

        }

    }

    ["merge"](other) {

        other = other["to"](this["file_format"]());

        this["records"] = this["records"].concat(
            DiaryBase.unique(
                this["records"],
                other["records"],
                ["Id"]
            )
        );

        return this;

    }

    ["file_format"]() { return "SleepAsAndroid"; }
    ["format_info"]() {
        return {
            "name": "SleepAsAndroid",
            "title": "Sleep as Android",
            "url": "/src/SleepAsAndroid",
            "statuses": [ "asleep" ],
            "extension": ".zip",
            "logo": "https://docs.sleep.urbandroid.org/assets/images/logo.png",
        }
    }

}

// Register this as a sleep diary:
DiaryBase.register(DiarySleepAsAndroid);
