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
 * Valid record statuses
 * @enum {string}
 */
const DiaryStandardRecordStatus = {
    /** user is currently awake */
    awake : "awake" ,
    /** user is in bed but not asleep */
    in_bed: "in bed",
    /** user is asleep */
    asleep: "asleep",
    /** user is currently turning off the lights in preparation to go to bed */
    "lights off": "lights off",
    /** user is currently turning on the lights after getting out of bed */
    "lights on": "lights on",
    /** user is eating some food, but not a full meal */
    snack: "snack",
    /** user is eating a full meal */
    meal: "meal",
    /** user is consuming alcohol */
    alcohol: "alcohol",
    /** user is consuming chocolate */
    chocolate: "chocolate",
    /** user is consuming caffeine */
    caffeine: "caffeine",
    /** user is consuming a drink that doesn't fit into any other category */
    drink: "drink",
    /** user is taking a sleeping pill, tranqulisier, or other medication to aid sleep */
    "sleep aid": "sleep aid",
    /** user is exercising */
    exercise: "exercise",
    /** user is using the toilet */
    toilet: "toilet",
    /** user is experiencing noise that disturbs their sleep */
    noise: "noise",
    /** user's wake-up alarm is trying to wake them up */
    alarm: "alarm",
    /** user is currently getting into bed */
    "in bed": "in bed",
    /** user is currently getting out of bed */
    "out of bed": "out of bed",

};

/**
 * @typedef {{
 *   start               : number,
 *   end                 : number,
 *   status              : DiaryStandardRecordStatus,
 *   start_timezone      : (undefined|string),
 *   end_timezone        : (undefined|string),
 *   duration            : (undefined|number),
 *   tags                : (undefined|Array<string>),
 *   comments            : (undefined|Array<string|{time:number,text:string}>),
 *   day_number          : number,
 *   start_of_new_day    : boolean,
 *   is_primary_sleep    : boolean,
 *   missing_record_after: boolean
 * }} DiaryStandardRecord
 *
 * A single record in a diary (e.g. one sleep) - see README.md for details
 *
 */
let DiaryStandardRecord;

/**
 * @typedef {{
 *                 average           : number,
 *                 mean              : number,
 *   interquartile_mean              : number,
 *                 standard_deviation: number,
 *   interquartile_standard_deviation: number,
 *                 median            : number,
 *   interquartile_range             : number,
 *                 durations         : Array<number|undefined>,
 *   interquartile_durations         : Array<number|undefined>,
 *         rolling_average           : Array<number|undefined>,
 *                 timestamps        : Array<number|undefined>
 * }} DiaryStandardStatistics
 *
 * Information about records from a diary
 */
let DiaryStandardStatistics;

/**
 * @typedef {null|DiaryStandardStatistics} MaybeDiaryStandardStatistics
 */
let MaybeDiaryStandardStatistics;

/**
 * @public
 * @unrestricted
 * @augments DiaryBase
 *
 * @example
 * let diary = new_sleep_diary(contents_of_my_file));
 *
 * // print the minimum expected day duration in milliseconds:
 * console.log(diary.settings.minimum_day_duration);
 * -> 12345
 *
 * // print the maximum expected day duration in milliseconds:
 * console.log(diary.settings.maximum_day_duration);
 * -> 23456
 *
 * // Print the complete list of records
 * console.log(diary.records);
 * -> [
 *      {
 *        // DiaryStandardRecordStatus value, usually "awake" or "asleep"
 *        status: "awake",
 *
 *        // start and end time (in milliseconds past the Unix epoch), estimated if the user forgot to log some data:
 *        start: 12345678,
 *        end: 23456789,
 *        start_timezone: "Etc/GMT-1",
 *        end_timezone: "Europe/Paris",
 *
 *        duration: 11111111, // or missing if duration is unknown
 *
 *        // tags associated with this period:
 *        tags: [
 *          "tag 1",
 *          "tag 2",
 *          ...
 *        ],
 *
 *        // comments recorded during this period:
 *        comments: [
 *          "comment with no associated timestamp",
 *          { time: 23456543, text: "timestamped comment" },
 *          ...
 *        ],
 *
 *        // (estimated) day this record is assigned to:
 *        day_number: 1,
 *
 *        // true if the current day number is greater than the previous record's day number:
 *        start_of_new_day: true,
 *
 *        // whether this value is the primary sleep for the current day number:
 *        is_primary_sleep: false,
 *
 *        // this is set if it looks like the user forgot to log some data:
 *        missing_record_after: true
 *
 *      },
 *
 *      ...
 *
 *    ]
 *
 * // Print the user's current sleep/wake status:
 * console.log(diary.latest_sleep_status());
 * -> "awake"
 *
 * // Print the user's sleep statistics:
 * console.log( diary.summarise_records( record => record.status == "asleep" ) );
 * -> {
 *                    average           : 12345.678,
 *                    mean              : 12356.789,
 *      interquartile_mean              : 12345.678,
 *                    standard_deviation: 12.56,
 *      interquartile_standard_deviation: 12.45,
 *                    median            : 12345,
 *      interquartile_range             : 12,
 *                    durations         : [ undefined, 12345, undefined, ... ],
 *      interquartile_durations         : [ 10000, 10001 ... 19998, 19999 ],
 *    }
 *
 * // Print the user's day length statistics for the past 14 days:
 * let cutoff = new Date().getTime() - 1000*60*60*24*14;
 * console.log( diary.summarise_days( record => record.start > cutoff ) );
 * -> {
 *                    average           : 12345.678,
 *                    mean              : 12356.789,
 *      interquartile_mean              : 12345.678,
 *                    standard_deviation: 12.56,
 *      interquartile_standard_deviation: 12.45,
 *                    median            : 12345,
 *      interquartile_range             : 12,
 *                    durations         : [ undefined, 12345, undefined, ... ],
 *      interquartile_durations         : [ 10000, 10001 ... 19998, 19999 ],
 *    }
 *
 * // Print the user's daily schedule on a 24-hour clock:
 * console.log( diary.summarise_schedule();
 * -> {
 *      sleep: { // time (GMT) when the user falls asleep:
 *                      average           : 12345.678,
 *                      mean              : 12356.789,
 *        interquartile_mean              : 12345.678,
 *                      standard_deviation: 12.56,
 *        interquartile_standard_deviation: 12.45,
 *                      median            : 12345,
 *        interquartile_range             : 12,
 *                      durations         : [ undefined, 12345, undefined, ... ],
 *        interquartile_durations         : [ 10000, 10001 ... 19998, 19999 ],
 *      },
 *      wake: { // time (GMT) when the user wakes up:
 *                      average           : 12345.678,
 *                      mean              : 12356.789,
 *        interquartile_mean              : 12345.678,
 *                      standard_deviation: 12.56,
 *        interquartile_standard_deviation: 12.45,
 *                      median            : 12345,
 *        interquartile_range             : 12,
 *                      durations         : [ undefined, 12345, undefined, ... ],
 *        interquartile_durations         : [ 10000, 10001 ... 19998, 19999 ],
 *      },
 *    }
 *
 * // Print the user's daily schedule on a 24-hour clock for the past 14 days:
 * let cutoff = new Date().getTime() - 1000*60*60*24*14;
 * console.log( diary.summarise_schedule( record => record.start > cutoff ) );
 * -> {
 *      sleep: { // time (GMT) when the user falls asleep:
 *                      average           : 12345.678,
 *                      mean              : 12356.789,
 *        interquartile_mean              : 12345.678,
 *                      standard_deviation: 12.56,
 *        interquartile_standard_deviation: 12.45,
 *                      median            : 12345,
 *        interquartile_range             : 12,
 *                      durations         : [ undefined, 12345, undefined, ... ],
 *        interquartile_durations         : [ 10000, 10001 ... 19998, 19999 ],
 *      },
 *      wake: { // time (GMT) when the user wakes up:
 *                      average           : 12345.678,
 *                      mean              : 12356.789,
 *        interquartile_mean              : 12345.678,
 *                      standard_deviation: 12.56,
 *        interquartile_standard_deviation: 12.45,
 *                      median            : 12345,
 *        interquartile_range             : 12,
 *                      durations         : [ undefined, 12345, undefined, ... ],
 *        interquartile_durations         : [ 10000, 10001 ... 19998, 19999 ],
 *      },
 *    }

 * // Print the user's daily schedule on a 25-hour clock, defaulting to Cairo's timezone:
 * console.log( diary.summarise_schedule( null, 25*60*60*1000, "Africa/Cairo" ) );
 * -> {
 *      sleep: { // time (Cairo) when the user falls asleep:
 *                      average           : 12345.678,
 *                      mean              : 12356.789,
 *        interquartile_mean              : 12345.678,
 *                      standard_deviation: 12.56,
 *        interquartile_standard_deviation: 12.45,
 *                      median            : 12345,
 *        interquartile_range             : 12,
 *                      durations         : [ undefined, 12345, undefined, ... ],
 *        interquartile_durations         : [ 10000, 10001 ... 19998, 19999 ],
 *      },
 *      wake: { // time (Cairo) when the user wakes up:
 *                      average           : 12345.678,
 *                      mean              : 12356.789,
 *        interquartile_mean              : 12345.678,
 *                      standard_deviation: 12.56,
 *        interquartile_standard_deviation: 12.45,
 *                      median            : 12345,
 *        interquartile_range             : 12,
 *                      durations         : [ undefined, 12345, undefined, ... ],
 *        interquartile_durations         : [ 10000, 10001 ... 19998, 19999 ],
 *      },
 *    }

 */
class DiaryStandard extends DiaryBase {

    /**
     * @param {Object} file - file contents, or object containing records
     * @param {Array=} file.records - individual records from the sleep diary
     * @param {number=} file.minimum_day_duration - minimum expected day duration in milliseconds
     * @param {number=} file.maximum_day_duration - maximum expected day duration in milliseconds
     * @param {Function=} serialiser - function to serialise output
     */
    constructor(file,serialiser) {

        super(file,serialiser);

        if ( file["records"] && !file["file_format"] ) {
            file = {
                "file_format": () => "Standard",
                "contents"   : file,
            };
        }

        /**
         * Spreadsheet manager
         * @protected
         * @type {Spreadsheet}
         */
        this["spreadsheet"] = new Spreadsheet(this,[
            {
                "sheet" : "Records",
                "member" : "records",
                "cells": [
                    {
                        "member": "status",
                        "regexp": new RegExp('^(' + Object.values(DiaryStandardRecordStatus).join('|') + ')$'),
                        "type"  : "string",
                    },
                    {
                        "member"  : "start",
                        "type"    : "time",
                        "optional": true,
                    },
                    {
                        "member"  : "end",
                        "type"    : "time",
                        "optional": true,
                    },
                    {
                        "member": "start_timezone",
                        "type"  : "string",
                        "optional": true,
                    },
                    {
                        "member": "end_timezone",
                        "type"  : "string",
                        "optional": true,
                    },
                    {
                        "member"  : "duration",
                        "type"    : "duration",
                        "optional": true,
                    },
                    {
                        "members": ["tags"],
                        "export": (array_element,row,offset) => row[offset] = Spreadsheet.create_cell( (array_element["tags"]||[]).join("; ") ),
                        "import": (array_element,row,offset) => {
                            if ( row[offset]["value"] ) {
                                const tags = row[offset]["value"].split(/ *; */);
                                array_element["tags"] = tags;
                            }
                            return true;
                        }
                    },
                    {
                        "members": ["comments"],
                        "export": (array_element,row,offset) => row[offset] = Spreadsheet.create_cell(
                            (array_element["comments"]||[])
                                .map( c => c["time"] ? `TIME=${c["time"]} ${c["text"]}` : c )
                                .join("; ")
                        ),
                        "import": (array_element,row,offset) => {
                            if ( row[offset]["value"] ) {
                                const comments =
                                      row[offset]["value"]
                                      .split(/ *; */)
                                      .map( c => {
                                          var time;
                                          c = c.replace( /^TIME=([0-9]*) */, (_,t) => { time = parseInt(t,10); return '' });
                                          return time ? { "time": time, "text": c } : c;
                                      });
                                array_element["comments"] = comments;
                            }
                            return true;
                        },
                    },
                    {
                        "member": "day_number",
                        "type": "number",
                        "optional": true,
                    },
                    {
                        "member": "start_of_new_day",
                        "type": "boolean",
                        "optional": true,
                    },
                    {
                        "member": "is_primary_sleep",
                        "type": "boolean",
                        "optional": true,
                    },
                    {
                        "member": "missing_record_after",
                        "type": "boolean",
                        "optional": true,
                    },
                ]
            },

            {
                "sheet" : "Settings",
                "member" : "settings",
                "type" : "dictionary",
                "cells": [
                    {
                        "member": "minimum_day_duration",
                        "type"  : "duration",
                    },
                    {
                        "member": "maximum_day_duration",
                        "type"  : "duration",
                    },
                ],
            },

        ]);

        switch ( file["file_format"]() ) {

        case "string":
            try {
                file = {
                    "file_format": () => "Standard",
                    "contents": /** @type (Object|null) */ (JSON.parse(file["contents"])),
                }
            } catch (e) {
                return this.invalid(file);
            }
            if ( file["contents"]["file_format"] != "Standard" ) {
                return this.invalid(file);
            }
            // FALL THROUGH

        default:

            if ( this.initialise_from_common_formats(file) ) return;

            let contents = file["contents"];
            if (
                file["file_format"]() != "Standard" ||
                contents === null ||
                typeof(contents) != "object" ||
                !Array.isArray(contents["records"])
            ) {
                return this.invalid(file);
            }

            /**
             * Individual records from the sleep diary
             *
             * @type Array<DiaryStandardRecord>
             */
            this["records"] = contents["records"]
                .map( r => Object.assign({},r) )
                .sort( (a,b) => ( a["start"] - b["start"] ) || ( a["end"] - b["end"] ) )
            ;

            const settings = contents["settings"]||contents,
                  minimum_day_duration = settings["minimum_day_duration"] || 16*60*60*1000,
                  maximum_day_duration = settings["maximum_day_duration"] || minimum_day_duration*2
            ;

            this["settings"] = {

                /**
                 * Minimum expected length for a day
                 *
                 * <p>We calculate day numbers by looking for "asleep"
                 * records at least this far apart.</p>
                 *
                 * @type number
                 */
                "minimum_day_duration": minimum_day_duration,

                /**
                 * Maximum expected length for a day
                 *
                 * <p>We calculate skipped days by looking for "asleep"
                 * records at this far apart</p>
                 *
                 * @type number
                 */
                "maximum_day_duration": maximum_day_duration,

            };

            /*
             * Calculate extra information
             */
            let day_start = 0,
                day_number = 0,
                prev = {
                    "status": "",
                    "day_number": -1
                },
                day_sleeps = [],
                sleep_wake_record = prev
            ;

            this["records"]
                .forEach( r => {

                    ["start","end"].forEach( key => {
                        if ( r[key] == undefined ) delete r[key];
                    });
                    ["tags","comments"].forEach( key => {
                        if ( !(r[key]||[]).length ) delete r[key];
                    });

                    if ( !r.hasOwnProperty("duration") ) {
                        r["duration"] = r["end"] - r["start"];
                        if ( isNaN(r["duration"]) ) delete r["duration"];
                    }

                    if ( r.hasOwnProperty("start_of_new_day") ) {
                        if ( r["start_of_new_day"] ) {
                            day_start = r["start"];
                        }
                    } else {
                        r["start_of_new_day"] =
                            r["status"] == "asleep" &&
                            r["start"] > day_start + minimum_day_duration
                        ;
                    }

                    if ( r.hasOwnProperty("day_number") ) {
                        day_number = r["day_number"];
                    } else {
                        if ( r["start_of_new_day"] ) {
                            if ( r["start"] > day_start + maximum_day_duration ) {
                                // assume we skipped a day
                                day_number += 2;
                            } else {
                                day_number += 1;
                            }
                            day_start = r["start"];
                        }
                        r["day_number"] = day_number;
                    }

                    if (  r["status"] == "awake" || r["status"] == "asleep" ) {
                        if ( !sleep_wake_record.hasOwnProperty("missing_record_after") ) {
                            sleep_wake_record["missing_record_after"] = (
                                r["status"] == sleep_wake_record["status"]
                            );
                        }
                        sleep_wake_record = r;
                    }

                    if ( r["status"] == "asleep" ) {

                        if ( (day_sleeps[r["day_number"]]||{"duration":-Infinity})["duration"] < r["duration"] ) {
                            day_sleeps[r["day_number"]] = r;
                        }
                    }

                    if ( r.hasOwnProperty("comments") ) {
                        const comments = r["comments"];
                        if ( comments === undefined ) {
                            delete r["comments"];
                        } else if ( !Array.isArray(comments) ) {
                            r["comments"] = [ comments ];
                        }
                    }

                    prev = r;

                })
            ;

            day_sleeps.forEach( r => {
                if ( r && !r.hasOwnProperty("is_primary_sleep") ) r["is_primary_sleep"] = true;
            });

        }

    }

    ["to"](to_format) {

        switch ( to_format ) {

        case "output":
            let contents = Object.assign({"file_format":this["file_format"]()},this);
            delete contents["spreadsheet"];
            return this.serialise({
                "file_format": () => "string",
                "contents": JSON.stringify(contents),
            });

        default:
            return super["to"](to_format);

        }

    }

    ["merge"](other) {
        let records = {};
        [ this, other["to"](this["file_format"]()) ].forEach(
            f => f["records"].forEach(
                r => records[[ r["start"], r["end"], r["status"] ].join()] = r
            )
        );
        this["records"] = Object.values(records).sort( (a,b) => ( a["start"] - b["start"] ) || ( a["end"] - b["end"] ) );
        return this;
    }

    ["file_format"]() { return "Standard"; }
    ["format_info"]() {
        return {
            "name": "Standard",
            "title": "Standardised diary format",
            "url": "/src/Standard",
            "extension": ".json",
        }
    }

    /**
     * Internal function used by summarise_*
     * @param {Array<Array<number>>} durations_and_timestamps - event durations and associated timestamps
     * @param {number=} rolling_average_max - maximum allowed value for the rolling average (e.g. 24 hours)
     * @private
     */
    static summarise(durations_and_timestamps,rolling_average_max) {

        let defined_durations = durations_and_timestamps
            .map( r => r[0] )
            .filter( r => r !== undefined ),
            total_durations   = defined_durations.length
        ;

        if ( !total_durations ) return null;

        let a_plus_b        = (a,b) => a+b,
            a_minus_b       = (a,b) => a-b,
            sum_of_squares  = (a,r) => a + Math.pow(r - mean, 2) ,
            rolling_window = [],

            sorted_durations  = defined_durations.sort(a_minus_b),
            interquartile_durations = sorted_durations.slice(
                Math.round( sorted_durations.length*0.25 ),
                Math.round( sorted_durations.length*0.75 ),
            ),

            mean,
                untrimmed_mean = defined_durations.reduce(a_plus_b) / (total_durations||1),
            interquartile_mean = interquartile_durations.reduce(a_plus_b) / (interquartile_durations.length||1),

            ret = {
                            "average": untrimmed_mean,
                               "mean": untrimmed_mean,
                 "interquartile_mean": interquartile_mean,

                             "median": sorted_durations[Math.floor(sorted_durations.length/2)],
                "interquartile_range": (
                    interquartile_durations[interquartile_durations.length-1] -
                    interquartile_durations[0]
                ),

                              "durations": durations_and_timestamps.map( r => r ? r[0] : undefined ),
                             "timestamps": durations_and_timestamps.map( r => r ? r[1] : undefined ),
                "interquartile_durations": interquartile_durations,
                        "rolling_average": durations_and_timestamps.map(
                    rolling_average_max
                    ? (_,n) => {
                        /*
                         * work around a similar issue to that described in summarise_schedule(),
                         * but using a different approach.
                         *
                         * Unlike summarise_schedule(), we want to switch between earlier and later
                         * values for every calculation, and can assume the rolling average
                         * has values in a relatively small range.
                         */
                        if ( n < 14 ) return undefined;
                        const rolling_window = durations_and_timestamps
                              .slice(Math.max(0,n-13),n+1)
                              .map( r => r[0] )
                              .filter( r => r !== undefined ),
                              extremes = [ 0, 0 ]
                              ;
                        rolling_window.forEach( duration => {
                            if ( duration<rolling_average_max*1/4 ) {
                                ++extremes[0]
                            } else if ( duration>rolling_average_max*3/4 ) {
                                ++extremes[1];
                            }
                        });
                        return (
                            rolling_window.length
                            ? (
                                rolling_window.reduce( (a,b) => a + b )
                                    + ( extremes[0] < extremes[1]
                                        ? extremes[0]* rolling_average_max
                                        : extremes[1]*-rolling_average_max
                                      )
                            ) / rolling_window.length
                            : undefined
                        );
                    }
                    : (_,n) => {
                        const rolling_window = durations_and_timestamps
                              .slice(Math.max(0,n-13),n+1)
                              .map( r => r[0] )
                              .filter( r => r !== undefined )
                        ;
                        return (
                            ( n >= 14 && rolling_window.length )
                            ? rolling_window.reduce( (a,b) => a+b ) / rolling_window.length
                            : undefined
                        );
                    }
                ),
        };

        // calculate standard deviations:
        mean = untrimmed_mean;
        ret["standard_deviation"] = Math.sqrt( defined_durations.reduce(sum_of_squares,0) / total_durations );
        mean = interquartile_mean;
        ret["interquartile_standard_deviation"] = Math.sqrt( interquartile_durations.reduce(sum_of_squares,0) / interquartile_durations.length );

        return ret;

    }

    /**
     * Summary statistics (based on individual records)
     *
     * <p>Because real-world data tends to be quite messy, and because
     * different users have different requirements, we provide several
     * summaries for the data:</p>
     *
     * <ul>
     *  <li><tt>average</tt> is the best guess at what the
     *      user would intuitively consider the average duration of a
     *      record.  The exact calculation is chosen from the list
     *      below, and may change in future.  It is currently the
     *      <tt>trimmed_mean</tt>.  If you don't have any specific
     *      requirements, you should use this and ignore the
     *      others.</li>
     *  <li><tt>mean</tt> and <tt>standard_deviation</tt> are
     *      traditional summary statistics for the duration, but are
     *      not recommended because real-world data tends to skew
     *      these values higher than one would expect.</li>
     *  <li><tt>interquartile_mean</tt> and <tt>interquartile_standard_deviation</tt>
     *      produce more robust values in cases like ours, because they
     *      ignore the highest and lowest few records.
     *  <li><tt>median</tt> and <tt>interquartile_range</tt> produce
     *      more robust results, but tend to be less representative when
     *      there are only a few outliers in the data.
     *  <li><tt>durations</tt> and <tt>interquartile_durations</tt>
     *      are the raw values the other statistics were created from.
     * </ul>
     *
     * @public
     *
     * @param {function(*)=} filter - only examine records that match this filter
     *
     * @return MaybeDiaryStandardStatistics
     *
     * @example
     * console.log( diary.summarise_records( record => record.status == "asleep" ) );
     * -> {
     *                    average           : 12345.678,
     *                    mean              : 12356.789,
     *      interquartile_mean              : 12345.678,
     *                    standard_deviation: 12.56,
     *      interquartile_standard_deviation: 12.45,
     *                    median            : 12345,
     *      interquartile_range             : 12,
     *                    durations         : [ undefined, 12345, undefined, ... ],
     *      interquartile_durations         : [ 10000, 10001 ... 19998, 19999 ],
     *    }
     *
     */
    ["summarise_records"](filter) {

        return DiaryStandard.summarise(
            ( filter ? this["records"].filter(filter) : this["records"] )
                .map( r => [ r["duration"], r["start"]||r["end"] ] )
        );

    }

    /**
     * Summary statistics (based on records grouped by day_number)
     *
     * <p>Similar to {@link DiaryStandard#summarise_records}, but
     * groups records by day_number.</p>
     *
     * @public
     *
     * @see [summarise_records]{@link DiaryStandard#summarise_records}
     * @tutorial Graph your day lengths
     *
     * @param {function(*)=} filter - only examine records that match this filter
     *
     * @return MaybeDiaryStandardStatistics
     *
     * @example
     * console.log( diary.summarise_days( record => record.start > cutoff ) );
     * -> {
     *                    average           : 12345.678,
     *                    mean              : 12356.789,
     *      interquartile_mean              : 12345.678,
     *                    standard_deviation: 12.56,
     *      interquartile_standard_deviation: 12.45,
     *                    median            : 12345,
     *      interquartile_range             : 12,
     *                    durations         : [ undefined, 12345, undefined, ... ],
     *      interquartile_durations         : [ 10000, 10001 ... 19998, 19999 ],
     *    }
     */
    ["summarise_days"](filter) {

        let starts = [];
        // get the earliest start time for each day:
        ( filter ? this["records"].filter(filter) : this["records"] )
            .forEach( r => {
                const day_number = r["day_number"];
                if (
                    r["start_of_new_day"]
                    // "start" of new day is unreliable for the first day:
                    && day_number
                ) {
                    starts[day_number] = r["start"];
                }
            });

        // remove leading undefined start times:
        while ( starts.length && !starts[0] ) {
            starts.shift();
        }

        // calculate day duration relative to previous day:
        let durations = [];
        for ( let n=1; n<starts.length; ++n ) {
            if ( starts[n] && starts[n-1] ) {
                durations[n-1] = [ starts[n] - starts[n-1], starts[n-1] ];
            }
        }

        return DiaryStandard.summarise(durations);

    }

    /**
     * Summary statistics about the number of times an event occurs per day
     *
     * <p>Similar to {@link DiaryStandard#summarise_days}, but
     * looks at totals instead of sums.</p>
     *
     * <p>The <tt>summarise_*</tt> functions examine sums, so missing
     * values are treated as <tt>undefined</tt>.  This function
     * examines totals, so missing values are treated as <tt>0</tt>.
     * The <tt>record_filter</tt> and <tt>day_filter</tt> parameters
     * allow you to exclude days and records separately.</p>
     *
     * @public
     *
     * @see [summarise_records]{@link DiaryStandard#summarise_records}
     *
     * @param {function(*)=} record_filter - only examine records that match this filter
     * @param {function(*)=}    day_filter - only examine days that match this filter
     *
     * @return MaybeDiaryStandardStatistics
     *
     * @example
     * console.log( diary.total_per_day(
     *   record => record.status == "asleep", // only count sleep records
     *   record => record.start > cutoff      // ignore old records
     * ) );
     * -> {
     *                    average           : 1.234,
     *                    mean              : 1.345,
     *      interquartile_mean              : 1.234,
     *                    standard_deviation: 0.123,
     *      interquartile_standard_deviation: 0.012,
     *                    median            : 1,
     *      interquartile_range             : 1,
     *                    counts            : [ undefined, 1, undefined, ... ],
     *      interquartile_counts            : [ 1, 1, 2, 1, 1, 0, ... ],
     *      // included for compatibility with summarise_* functions:
     *                    durations         : [ undefined, 1, undefined, ... ],
     *      interquartile_durations         : [ 1, 1, 2, 1, 1, 0, ... ],
     *    }
     */
    ["total_per_day"](record_filter,day_filter) {

        let counts = [],
            cutoff = (
                // duration cannot be calculated for an incomplete day:
                this["records"].length
                    ? this["records"][this["records"].length-1]["day_number"]
                    : 0
            );

        ( day_filter ? this["records"].filter(day_filter) : this["records"] )
            .forEach( r =>
                (
                    counts[r["day_number"]] = counts[r["day_number"]] || [ 0, r["start"] ]
                )[0] += ( record_filter && !record_filter(r) ? 0 : 1 )
            );

        counts = counts.slice( 1, cutoff );

        // remove leading undefined start times:
        while ( counts.length && counts[0] === undefined ) {
            counts.shift();
        }

        return DiaryStandard.summarise(counts);

    }

    /**
     * Summary statistics about daily events
     *
     * <p>Somewhat similar to {@link DiaryStandard#summarise_records}.</p>
     *
     * <p>Calculates the time of day when the user is likey to wake up
     * or go to sleep.</p>
     *
     * <p>Sleep/wake times are currently calculated based on the
     * beginning/end time for each day's primary sleep, although this
     * may change in future.</p>
     *
     * <p>Times are calculated according to the associated timezone.
     * For example, say you woke up in New York at 8am, flew to Los
     * Angeles, went to bed and woke up again at 8am local time.  You
     * would be counted as waking up at 8am both days, even though 27
     * hours had passed between wake events.</p>
     *
     * <p>Records without a timezone are treated as if they had the
     * environment's default timezone</p>
     *
     * @public
     *
     * @see [summarise_records]{@link DiaryStandard#summarise_records}
     *
     * @param {function(*)=} [filter=null] - only examine records that match this filter
     * @param {number=} [day_length=86400000] - times of day are calculated relative to this amount of time
     * @param {string=} [timezone=system_timezone] - default timezone for records
     *
     * @return {{
     *   sleep : MaybeDiaryStandardStatistics,
     *   wake  : MaybeDiaryStandardStatistics
     * }}
     *
     * @example
     * console.log( diary.summarise_schedule() );
     * -> {
     *      sleep: { // time when the user falls asleep:
     *                      average           : 12345.678,
     *                      mean              : 12356.789,
     *        interquartile_mean              : 12345.678,
     *                      standard_deviation: 12.56,
     *        interquartile_standard_deviation: 12.45,
     *                      median            : 12345,
     *        interquartile_range             : 12,
     *                      durations         : [ undefined, 12345, undefined, ... ],
     *        interquartile_durations         : [ 10000, 10001 ... 19998, 19999 ],
     *      },
     *      wake: { // time when the user wakes up:
     *                      average           : 12345.678,
     *                      mean              : 12356.789,
     *        interquartile_mean              : 12345.678,
     *                      standard_deviation: 12.56,
     *        interquartile_standard_deviation: 12.45,
     *                      median            : 12345,
     *        interquartile_range             : 12,
     *                      durations         : [ undefined, 12345, undefined, ... ],
     *        interquartile_durations         : [ 10000, 10001 ... 19998, 19999 ],
     *      },
     *    }
     */
    ["summarise_schedule"](filter,day_length,timezone) {

        /*
         * Note: this function needs to work around a weird issue.
         *
         * If a user went to sleep at 00:10am then at 11:50pm, a naive
         * algorithm might calculate the user's mean sleep time to be
         * midday instead of midnight.  To avoid this problem, we
         * calculate values twice - once normally and once with all
         * numbers rotated by half the day length.  Then we use
         * whichever one has the lowest standard deviation.
         */

        const hours = 60*60*1000;

        day_length = day_length || 24*hours;
        timezone   = timezone   || system_timezone;

        const half_day_length = day_length/2;

        // get the earliest start time for each day:
        let sleep_early = [],
            sleep_late  = [],
            wake_early  = [],
            wake_late   = []
        ;
        ( filter ? this["records"].filter(filter) : this["records"] )
            .forEach( r => {
                if ( r["is_primary_sleep"] ) {
                    if ( r["start"] ) {
                        let time = r["start"],
                            tz = r["start_timezone"]||timezone;
                        time += (
                            DiaryBase.date(time,tz)["offset"]()
                        ) * 60000;
                        sleep_early.push([ time                 %day_length, time ]);
                        sleep_late .push([(time+half_day_length)%day_length, time ]);
                    }
                    if ( r["end"] ) {
                        let time = r["end"],
                            tz = r["end_timezone"]||timezone;
                        time += (
                            DiaryBase.date(time,tz)["offset"]()
                        ) * 60000;
                        wake_early .push([ time                 %day_length, time ]);
                        wake_late  .push([(time+half_day_length)%day_length, time ]);
                    }
                }
            });

        let sleep_stats_early = DiaryStandard.summarise(sleep_early,day_length),
            sleep_stats_late  = DiaryStandard.summarise(sleep_late ,day_length),
             wake_stats_early = DiaryStandard.summarise( wake_early,day_length),
             wake_stats_late  = DiaryStandard.summarise( wake_late ,day_length)
        ;

        [
            [ sleep_stats_late, sleep_stats_early ],
            [  wake_stats_late,  wake_stats_early ],
        ].forEach( stats => {
            if ( stats[0] ) {
                [ "average", "mean", "interquartile_mean", "median" ].forEach(
                    key => stats[0][key] = ( stats[0][key] + half_day_length ) % day_length
                );
                [ "durations", "interquartile_durations" ].forEach(
                    key => stats[0][key] = stats[1][key]
                );
                stats[0]["rolling_average"] = stats[1]["rolling_average"];
            }
        });

        return {
            "wake": (
                (wake_stats_early||{})["standard_deviation"] < (wake_stats_late||{})["standard_deviation"]
                ? wake_stats_early
                : wake_stats_late
            ),
            "sleep": (
                (sleep_stats_early||{})["standard_deviation"] < (sleep_stats_late||{})["standard_deviation"]
                ? sleep_stats_early
                : sleep_stats_late
            ),
        };

    }

    /**
     * List of activities, grouped by day
     *
     * <p>It can be useful to display a diary as a series of columns
     * or rows, each containing the activities for that day.  This
     * function returns a structure that accounts for the following
     * issues:</p>
     *
     * <p><strong>Multi-day records</strong> - the function returns a
     * list of <em>days</em>, which contain <em>activities</em> -
     * parts of a record confined within that day.</p>
     *
     * <p><strong>Daylight savings time</strong> - if the timezone
     * observes daylight savings time (e.g. `Europe/London` instead of
     * `Etc/GMT`), the function will modify days to account for DST
     * changes (so a 24-hour diary will start at the same time
     * every day, even if that means having a 23- or 25-hour day).</p>
     *
     * <p><strong>Missing days</strong> - if a user skips a day, or
     * stops recording altogether for months or even years, the
     * function will leave a gap in the array for each missing
     * day.</p>
     *
     * <p>Not including workarounds for a few edge cases, the start
     * and end times for days are calculated like this:</p>
     *
     * <ol>
     *  <li>Find the start of the first day:
     *   <ol>
     *    <li>find the earliest date in the list of records
     *    <li>find the last time at or before that date
     *     where the time equals `day_start` in `timezone`
     *    <li>if that date would be invalid (because a DST change
     *     causes that time to be skipped), move backwards by the DST
     *     change duration.
     *   </ol>
     *  </li>
     *  <li>Find the start of the next day:
     *   <ol>
     *    <li>move forwards in time by `day_stride`
     *    <li>move backwards by the difference between the start and end timezone offsets<br>
     *     (so a 24-hour `day_stride` will always start at the same time of day)
     *   </ol>
     *  </li>
     *  <li>Create a new day object with the start of the current and next day</li>
     *  <li>Continue moving forward one day at a time until we reach the final record
     * </ul>
     *
     * <p>An activity represents the fraction of a record that exists
     * within the current day.  For example, a record that lasted two
     * days would have two associated records.  Activity times are
     * decided like this:</p>
     *
     * <ul>
     *  <li>if a record has neither a `start` nor `end` time, no activities are created
     *  <li>if a record has exactly one `start` or `end` time, one activity is created.
     *   The activity has a `time` equal to whichever was defined.
     *  <li>if a record has both `start` and `end`, and both are within the same day,
     *   one activity is created. The activity has a `time` halfway between the two.
     *  <li>if a record has both `start` and `end` that span multiple days,
     *   one activity is created for each day the record is active.  The first
     *   activity has a `time` halfway between `start` and the end of that day.
     *   middle activities have a `time` equal to the middle of the day.  The final
     *   activity has a `time` halfway between the start of that day and `end`
     * </ul>
     *
     * <p>Each activity includes a `type`, which is one of:</p>
     *
     * <ul>
     *  <li>`start-end` - complete duration of an event
     *  <li>`start-mid` - start of an event that spans multiple days
     *  <li>`mid-mid` - middle of an event that spans multiple days
     *  <li>`mid-end` - end of an event that spans multiple days
     *  <li>`start-unknown` - start of an event with an undefined end time
     *  <li>`unknown-end` - end of an event with an undefined start time
     * </ul>
     *
     * <p>If a `segment_stride` argument is passed, segments for a day
     * are calculated like this:</p>
     *
     * <ol>
     *  <li>create a segment that starts at the `start` time
     *  <li>check whether the DST offset is the same at the start and end of the day
     *  <ul>
     *   <li>if not, create segments `segment_stride` apart
     *   <li>otherwise...
     *    <ul>
     *     <li>continue forwards until the current segment's end time is
     *      greater than the `end` time, or the timezone's DST status
     *      changes
     *     <li>stop unless a DST change was crossed
     *     <li>create a new segment that ends at the `end` time
     *     <li>continue backwards until the current segment's start time
     *      is less than or equal to the last segment from amove
     *     <li>sort all segments by start time
     *    </ul>
     *   </li>
     * </ol>
     *
     * <p>The algorithm above should produce intuitive dates in most
     *  cases, but produces unexpected behaviour if there is more than
     *  one DST change in a single day.</p>
     *
     * <p>Be aware that some timezones have [a 45-minute offset from
     * UTC](https://en.wikipedia.org/wiki/UTC%2B05:45), and [even more
     * esoteric
     * timezones](https://en.wikipedia.org/wiki/UTC%E2%88%9200:25:21),
     * existed in the 20th century.  You may need to test your program
     * carefully to avoid incorrect behaviour in some cases.</p>
     *
     * @public
     *
     * @param {string} [timezone=system_timezone] - display dates in this timezone
     * @param {number} [day_start=64800000] - start the first new day at this time (usually 6pm)
     * @param {number} [day_stride=86400000] - amount of time to advance each day (usually 24 hours)
     * @param {number=} [segment_stride] - amount of time to advance each segment
     *
     * @example
     * console.log( diary.daily_activities() );
     * -> [
     *      {
     *        "start"   : 123456789, // Unix time when the day starts
     *        "end"     : 234567890, // start + day_stride - dst_change
     *        "duration": 11111111, // end - start
     *        "id"      : "2020-03-30T18:00:00.000 Etc/GMT" // ISO 8601 equivalent of "start"
     *        "year"    : 2020,
     *        "month"   : 2, // zero-based month number
     *        "day"     : 29, // zero-based day of month
     *        "activities": [
     *          {
     *            "start"       : 123459999, // time when the event started (optional)
     *            "end"         : 234560000, // time when the event ended (optional)
     *            "time"        : 200000000, // time associated with the event (required)
     *            "offset_start": 0.1, // ( start - day.start ) / day.duration
     *            "offset_end"  : 0.9, // ( end - day.start ) / day.duration
     *            "offset_time" : 0.5, // ( time - day.start ) / day.duration
     *            "type"        : "start-end" // see above for list of types
     *            "record"      : { ... }, // associated record
     *            "index"       : 0, // this is the nth activity for this record
     *          },
     *        ],
     *        "activity_summaries": {
     *          "asleep": {
     *            "first_start": "2020-03-30T20:00:00.000 Etc/GMT", // start of first activity
     *            "first_end"  : "2020-03-31T06:00:00.000 Etc/GMT", // end of first activity
     *             "last_start": "2020-03-31T14:00:00.000 Etc/GMT", // start of last activity
     *             "last_end"  : "2020-03-31T14:30:00.000 Etc/GMT", // end of last activity
     *            "duration"   : 37800000, // total milliseconds (NaN if some activities have undefined duration)
     *          },
     *          ...
     *        },
     *        "segments": [
     *          {
     *            "dst_state": "on" // or "off" or "change-forward" or "change-back"
     *            "year"  : 2020,
     *            "month" : 2, // zero-based month number
     *            "day"   : 29, // zero-based day of month
     *            "hour"  : 18,
     *            "minute": 0,
     *            "second": 0,
     *            "id"    : "2020-03-30T18:00:00.000 Etc/GMT"
     *          },
     *          ...
     *        ],
     *      },
     *      ...
     *    ]
     */
    ["daily_activities"]( timezone, day_start, day_stride, segment_stride ) {

        timezone   = timezone   || system_timezone;
        day_start  = ( day_start === undefined ) ? 1000*60*60*18 : day_start; // 6pm
        day_stride = day_stride || 1000*60*60*24; // 24 hours

        let records = this["records"].sort( (a,b) => (a["start"]||a["end"]) - (b["start"]||b["end"]) ),
            today = records.find( r => r["start"]||r["end"] ),
            next_dst_change = DiaryBase.next_dst_change( today?(today["start"]||today["end"])-1:0, timezone ),
            timezone_str  = timezone.replace(/^([A-Za-z])/," $1"),
            offset,
            offset_ms,
            is_dst,
            tomorrow,
            day_index = 0,
            days = [],
            current_activities,
            record_index
        ;
        const milliseconds = DiaryBase.tc()["TimeUnit"]["Millisecond"],
              advance_to = timestamp => {
                  let segment_dst_change = next_dst_change;
                  while ( tomorrow["unixUtcMillis"]() <= timestamp ) {
                      segment_dst_change = next_dst_change;
                      current_activities = 0;
                      ++day_index;
                      today = tomorrow;
                      tomorrow = tomorrow["add"]( day_stride, milliseconds );
                      if ( tomorrow["unixUtcMillis"]() >= next_dst_change ) {
                          next_dst_change = DiaryBase.next_dst_change(today["unixUtcMillis"](),timezone);
                          const offset_tomorrow = tomorrow["add"]( ( today["offset"]() - tomorrow["offset"]() ) * 60 * 1000, milliseconds );
                          if ( today["lessThan"](offset_tomorrow) ) {
                              // just in case someone e.g. sets a stride less than the DST change amount
                              const passed_timestamp = tomorrow["unixUtcMillis"]() > timestamp;
                              tomorrow = offset_tomorrow;
                              if ( passed_timestamp ) break;
                          }
                      }
                  }
                  if ( !current_activities ) {
                      const    today_ms = today["unixUtcMillis"](),
                            tomorrow_ms = tomorrow["unixUtcMillis"](),
                            day = days[day_index] = {
                                "start"     : today_ms,
                                "end"       : tomorrow_ms,
                                "duration"  : tomorrow_ms - today_ms,
                                "id"        : today.toString(),
                                "year"      : today["year"] ()  ,
                                "month"     : today["month"]()-1,
                                "day"       : today["day"]  ()-1,
                                "activities": current_activities = [],
                            }
                      ;
                      if ( segment_stride > 0 ) {
                          let segments  = day["segments"] = [],
                              segment_start = today_ms
                          ;
                          while ( segment_start < tomorrow_ms ) {

                              const dt = new Date( segment_start + offset_ms );

                              segments.push({
                                  "dst_state": is_dst?"on":"off",
                                  "id"       : dt.toISOString().replace(/Z/,timezone_str),
                                  "year"     : dt.getUTCFullYear()  ,
                                  "month"    : dt.getUTCMonth   (),
                                  "day"      : dt.getUTCDate    ()-1,
                                  "hour"     : dt.getUTCHours   (),
                                  "minute"   : dt.getUTCMinutes (),
                                  "second"   : dt.getUTCSeconds (),
                              });

                              segment_start += segment_stride;

                              if ( segment_start >= segment_dst_change ) {
                                  const time = DiaryBase.date( segment_start, today["zone"]()["name"]() );
                                  segments[segments.length-1]["dst_state"] = (
                                      "change-"
                                      + ( is_dst ? "back" : "forward" )
                                  );
                                  offset    = time["offsetDuration"]();
                                  offset_ms = offset["milliseconds"]();
                                  is_dst    = !offset["equals"]( today["standardOffsetDuration"]() );
                                  segment_dst_change = DiaryBase.next_dst_change(time["unixUtcMillis"](),timezone);
                              }

                          }
                      }
                  }
              },
              build_activity = (record,activity) => {
                  activity["time"] = (
                      (activity["start"]||activity["end"]) +
                      (activity["end"]||activity["start"])
                  ) / 2;
                  activity["record"] = record;
                  activity["index"] = record_index++;
                  //activity["related"] = related; // NO!  Would make `days` impossible to stringify
                  const day = days[days.length-1],
                        start = day["start"],
                        duration = day["duration"]
                  ;
                  [ "start", "end", "time" ].forEach( key => {
                      if ( activity[key] ) {
                          activity["offset_"+key] = ( activity[key] - start ) / duration
                      }
                  });
                  return activity;
              }
        ;

        if ( today ) {

            // get the base date:
            today = DiaryBase.date(today["start"]||today["end"],timezone);
            const base_time = today["unixUtcMillis"]() - today["startOfDay"]()["unixUtcMillis"]();
            today = today["sub"](
                ( ( base_time < day_start ) ? 1000*60*60*24 : 0 ) +
                base_time - day_start, milliseconds,
            );
            tomorrow = today["add"]( day_stride, milliseconds );

            const offset_tomorrow = tomorrow["add"]( ( today["offset"]() - tomorrow["offset"]() ) * 60 * 1000, milliseconds );
            if ( offset_tomorrow["greaterThan"](today) ) {
                // just in case someone e.g. sets a stride less than the DST change amount
                tomorrow = offset_tomorrow;
            }

            offset    = today["offsetDuration"]();
            offset_ms = offset["milliseconds"]();
            is_dst    = !offset["equals"]( today["standardOffsetDuration"]() );

            // convert records to days
            records.forEach(
                record => {

                    record_index = 0;

                    let start_timestamp = record["start"],
                        end_timestamp   = record["end"],
                        related = []
                    ;

                    if ( start_timestamp ) {

                        advance_to(start_timestamp);

                        if ( end_timestamp ) {
                            if ( tomorrow["unixUtcMillis"]() >= end_timestamp ) {
                                current_activities.push(build_activity(record,{
                                    "start": start_timestamp,
                                    "end"  : end_timestamp,
                                    "type" : "start-end",
                                }));
                            } else {
                                current_activities.push(build_activity(record,{
                                    "start": start_timestamp,
                                    "end"  : tomorrow["unixUtcMillis"](),
                                    "type" : "start-mid",
                                }));
                                for (;;) {
                                    advance_to(tomorrow["unixUtcMillis"]()+1);
                                    if ( tomorrow["unixUtcMillis"]() >= end_timestamp ) break;
                                    current_activities.push(build_activity(record,{
                                        "start": today["unixUtcMillis"](),
                                        "end"  : tomorrow["unixUtcMillis"](),
                                        "type" : "mid-mid",
                                    }));
                                }
                                current_activities.push(build_activity(record,{
                                    "start": today["unixUtcMillis"](),
                                    "end"  : end_timestamp,
                                    "type" : "mid-end",
                                }));
                            }
                        } else {
                            current_activities.push(build_activity(record,{
                                "start": start_timestamp,
                                "type" : "start-unknown",
                            }));
                        }

                    } else if ( end_timestamp ) {

                        advance_to(end_timestamp);

                        current_activities.push(build_activity(record,{
                            "end" : end_timestamp,
                            "type": "unknown-end",
                        }));

                    }

                });

        }

        days.forEach( day => {

            const activity_summaries = day["activity_summaries"] = {};

            day["activities"].forEach( activity => {
                const status = activity["record"]["status"],
                      summary = (
                          activity_summaries[status] =
                          activity_summaries[status] || {
                              "duration": 0,
                          }
                      )
                ;
                ["start","end"].forEach( se => {
                    let time = activity[se];
                    if ( time !== undefined ) {
                        time = DiaryBase.date( time, timezone ).toString();
                        summary["last_"+se] = time;
                        if ( summary["first_"+se] == undefined ) {
                            summary["first_"+se] = time;
                        }
                    }
                });
                if ( activity["start"] && activity["end"] ) {
                    summary["duration"] += activity["end"] - activity["start"];
                } else {
                    summary["duration"] = NaN;
                }
            });

        });

        return days;

    }

    /**
     * Latest sleep/wake status
     *
     * @public
     *
     * @return {string} "awake", "asleep" or "" (for an empty diary)
     */
    ["latest_sleep_status"]() {

        for ( let n=this["records"].length-1; n>=0; --n ) {
            let status = this["records"][n]["status"];
            if ( status == "awake" || status == "asleep" ) return status;
        }
        return "";

    }

}

DiaryBase.register(DiaryStandard);
