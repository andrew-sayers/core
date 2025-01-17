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
 * @define {boolean} debugging mode
 * @package
 */
const DEBUG = false;

/**
 * Functions for converting from the current type to some other type
 * @private
 */
const sleepdiary_converters = {};

/**
 * @typedef {{
 *   name        : string,
 *   constructor : Function,
 *   title       : string,
 *   url         : string
 * }} DiaryEngine
 */
let DiaryEngine;

/**
 * List of known engines for sleep diaries
 * @type Array<DiaryEngine>
 * @tutorial List supported engines
 * @public
 */
const sleepdiary_engines = [];

/**
 * Default timezone for this system
 *
 * This is constant in normal operation, but can be overridden
 * by unit tests
 */
let system_timezone = (
    tz => ( tz == "UTC" ) ? "Etc/GMT" : tz
)( new Intl.DateTimeFormat().resolvedOptions().timeZone );

/**
 * @class Base class for sleep diary engines
 *
 * @unrestricted
 * @abstract
 */
class DiaryBase {

    /**
     * @param {string|Object} file - object containing the file
     * @param {Function=} serialiser - function to serialise output
     */
    constructor(file,serialiser) {
        if ( serialiser ) {
            /**
             * Serialise a value for output
             * @type {Function}
             */
            this.serialiser = serialiser;
        }
    }

    /*
     * Abstract functions
     */

    /**
     * Name of the current file format
     * @nocollapse
     * @public
     */
    static ["file_format"]() { return "DiaryBase" }

    /**
     * Merge another diary into this one
     *
     * @public
     *
     * @param {DiaryBase} other - diary to merge in
     *
     * @example
     *   diary.merge(my_data);
     */
    ["merge"](other) { return this; }

    /*
     * Functions that may or may not need to be overridden in descendent classes
     */

    /**
     * Create a deep copy of the current object
     */
    ["clone"]() {
        return new_sleep_diary(
            {
                "file_format": "storage-line",
                "contents": {
                    "file_format": this["file_format"](),
                    "contents"   : JSON.parse(
                        JSON.stringify(
                            this,
                            (key,value) => ( key == "spreadsheet" ) ? undefined : value
                        )
                    ),
                }
            },
            this.serialiser
        );
    }

    /**
     * Convert a value to some other format
     *
     * <p>Supported formats:</p>
     *
     * <ul>
     *   <li><tt>url</tt> - contents serialised for inclusion in a URL</li>
     *   <li><tt>json</tt> - contents serialised to JSON</li>
     *   <li><tt>storage-line</tt> - contents serialised for inclusion in a newline-separated list of diaries</li>
     *   <li><tt>Standard</tt> - Standard format</li>
     *   <li><em>(other formats)</em> - the name of any other diary format</li>
     * </ul>
     *
     * <p>[to_async()]{@link DiaryBase#to_async} supports more formats
     * and should be used where possible.  You should only call this
     * function directly if you want to guarantee synchronous execution.</p>
     *
     * @public
     *
     * @param {string} to_format - requested format
     * @return {*} diary data in new format
     *
     * @example
     * console.log( diary.to("NewFormat") );
     */
    ["to"](to_format) {

        switch ( to_format ) {

        case this["file_format"]():
            return this;

        case "url":
            return "sleepdiary=" + encodeURIComponent(JSON.stringify(
                {
                    "file_format": this["file_format"](),
                    "contents"   : this,
                },
                (key,value) => ( key == "spreadsheet" ) ? undefined : value
            ));

        case "json":
            return JSON.stringify(
                this,
                (key,value) => ( key == "spreadsheet" ) ? undefined : value
            );

        case "storage-line":
            return "storage-line:" + this["file_format"]() + ':' + JSON.stringify(
                this,
                (key,value) => ( key == "spreadsheet" ) ? undefined : value
            );

        default:
            if ( sleepdiary_converters.hasOwnProperty(to_format) ) {
                return new sleepdiary_converters[to_format](
                    this["to"]("Standard"),
                    this.serialiser,
                );
            } else {
                throw Error( this["file_format"]() + " cannot be converted to " + to_format);
            }

        }

    }

    /**
     * Convert a value to some other format
     *
     * <p>Supported formats:</p>
     *
     * <ul>
     *   <li><tt>output</tt> - contents serialised for output (e.g. to a file)</li>
     *   <li><tt>spreadsheet</tt> - binary data that can be loaded by a spreadsheet program</li>
     *   <li><em>(formats supported by [to()]{@link DiaryBase#to})</em></li>
     * </ul>
     *
     * <p>See also [to()]{@link DiaryBase#to}, a lower-level function
     * that supports formats that can be generated synchronously.  You
     * can use that function if a Promise interface would be
     * cumbersome or unnecessary in a given piece of code.</p>
     *
     * @public
     *
     * @param {string} to_format - requested format
     * @return {Promise|Object} Promise that returns the converted diary
     *
     * @example
     *   diary.to_async("NewFormat").then( reformatted => console.log( reformatted_diary ) );
     */
    ["to_async"](to_format) {

        switch ( to_format ) {

        case "spreadsheet":
            if ( !this["spreadsheet"]["synchronise"]() ) {
                throw Error("Could not synchronise data");
            }
            return this["spreadsheet"]["serialise"]();

        default:
            const ret = this["to"](to_format);
            return ret["then"] ? ret : { "then": callback => callback(ret) };
        }

    }

    /**
     * Serialise data for output
     * @protected
     */
    serialise(data) {
        return this.serialiser ? this.serialiser(data) : data;
    }

    /*
     * Construction helpers
     */

    /**
     * Register a new engine
     *
     * @public
     *
     * @param {Function} constructor - sleep diary engine
     *
     * @example
     *   DiaryBase.register(MyClass);
     */
    static register( constructor ) {
        let engine = constructor["prototype"]["format_info"]();
        engine["constructor"] = constructor;
        sleepdiary_engines.push(engine);
        if ( engine["url"][0] == '/' ) {
            engine["url"] = "https://sleepdiary.github.io/core" + engine["url"];
        }
        if ( engine.name != "Standard" ) {
            sleepdiary_converters[engine.name] = engine.constructor;
        }

    };

    /**
     * Indicates the file is not valid in our file format
     * @param {string|Object} file - file contents, or filename/contents pairs (for archive files)
     * @protected
     */
    invalid(file) {
        throw null;
    }

    /**
     * Indicates the file is a corrupt file in the specified format
     * @param {string|Object} file - file contents, or filename/contents pairs (for archive files)
     * @param {string} message - optional error message
     * @protected
     */
    corrupt(file,message) {
        if ( message ) {
            throw new Error( `Does not appear to be a valid ${this["file_format"]()} file:\n${message}` );
        } else {
            throw new Error( `Does not appear to be a valid ${this["file_format"]()} file` );
        }
    }

    /*
     * Attempt to initialise an object from common file formats
     * @param {Object} file - file to initialise from
     * @return {boolean} - whether parsing was successful
     */
    initialise_from_common_formats(file) {
        switch ( file["file_format"]() ) {

        case "url":
            file = file["contents"];
            if ( this["file_format"]() == file["file_format"] ) {
                Object.keys(file["contents"]).forEach( key => this[key] = file["contents"][key] );
                return true;
            } else {
                return this.invalid(file);
            }

        case "string":
        case "spreadsheet":
            if ( this["spreadsheet"]["load"](file) ) return true;
            // FALL THROUGH

        case "archive":
        case "array":
            this.invalid(file);

        }

        return false;
    }


    /*
     * Utility functions
     */

    /**
     * Convert a string to a number with leading zeros
     *
     * @param {number} n - number to pad
     * @param {number=} [length=2] - length of the output string
     *
     * @example
     * DiaryBase.zero_pad( 1    ) // ->   "01"
     * DiaryBase.zero_pad( 1, 4 ) // -> "0001"
     */
    static zero_pad( n, length ) {
        let zeros = '';
        if ( n ) {
            for ( let m=Math.pow( 10, (length||2)-1 ); m>n; m/=10 ) zeros += '0';
        } else {
            for ( let m=1; m<(length||2); ++m ) zeros += '0';
        }
        return zeros + n;
    }

    /**
     * parse an XML string to a DOM
     *
     * @param {string} string - XML string to parse
     * @protected
     *
     * @example
     *   let xml = DiaryBase.parse_xml("<foo>");
     */
    static parse_xml( string ) {

        let dom_parser;
        try {
            dom_parser = self.DOMParser;
            if ( !dom_parser ) throw "";
        } catch (e) {
            dom_parser = require("@xmldom/xmldom").DOMParser;
        }

        return new dom_parser().parseFromString(string, "application/xml");

    }

    /**
     * parse a timestamp in various formats
     *
     * @param {Object|number} value - value to analyse
     * @param {number=} epoch_offset - milliseconds between the unix epoch and the native offset
     * @return {number} Unix timestamp in milliseconds, or NaN if not parseable
     * @public
     *
     * @example
     *   let xml = DiaryBase.parse_xml("<foo>");
     */
    static parse_timestamp(value,epoch_offset) {

        const hours_to_milliseconds = 60 * 60 * 1000;

        if ( value === null ||
             value === undefined
           ) {
            return NaN;
        }

        if ( value["getTime"] ) {
            let time = value["getTime"]();
            if ( time <= 24*hours_to_milliseconds ) time += (epoch_offset||0);
            return time;
        }

        if ( value.match ) {

            const match = value.match(
                /^((19|20)[0-9]{2})[-.]?([0-9]{2})[-.]?([0-9]{2})[T ]?([0-9]{2})[.:]?([0-9]{2})(?:[.:]?([0-9]{2}))?Z?$/
            );
            if ( match ) {
                // YYYY-MM-DDThh:mm:ss
                return new Date(
                    parseInt(match[1],10),
                    parseInt(match[3],10)-1,
                    parseInt(match[4],10),
                    parseInt(match[5],10),
                    parseInt(match[6],10),
                    parseInt(match[7]||0,10)
                ).getTime();
            }

            if ( !value.search(/^[0-9]{4,}$/) ) {
                // string looks like a large number
                value = parseInt(value,10);
            }

        }

        if ( typeof(value) == "number" ) {
            // convert the number to milliseconds:
            const power_correction = 12 - Math.floor(Math.log10(/** @type {number} */(value)));
            return (
                value
                    * Math.pow(
                        10,
                        ( value && Math.abs(power_correction) > 2 )
                        ? power_correction
                        : 0
                    )
            );
        }

        // only string manipulation allowed beyond this point:
        if ( !value || !value.search ) return NaN;

        // treat e.g. "MidNight - 01:00" as "midnight", but leave "2010-11-12T13:14Z" alone:
        let cleaned_value = (
          ( value.search( /[a-su-y]/i ) == -1 && value.search( /-.*-/ ) != -1 )
          ? value
          : value.replace( /\s*(-|to).*/, "" )
        ).replace(/([ap])\s*(m)/i, "$1$2").toLowerCase();

        // common strings that don't match any pattern:
        if ( cleaned_value.search(/midnight/i) != -1 ) return 0;
        if ( cleaned_value.search(/midd?ay|noon|12pm/i) != -1 ) return 12*hours_to_milliseconds;

        // the value is e.g. "1am" or "2pm":
        let hour_match = cleaned_value.match(/^([0-9]*)(:([0-9]*))?\s*([ap])m$/);
        if ( hour_match ) {
            return (
                parseInt(hour_match[1],10) +
                parseInt(hour_match[3]||'0',10)/60 +
                ( hour_match[4] == 'p' ? 12 : 0 )
            ) * hours_to_milliseconds;
        }

        // the value is e.g. "00:00" or "14:30":
        let hhmmss_match = cleaned_value.match(/^([0-9]*)(:([0-9]*))?(:([0-9]*))?$/);
        if ( hhmmss_match ) {
            return (
                parseInt(hhmmss_match[1],10) +
                parseInt(hhmmss_match[3]||'0',10)/60 +
                parseInt(hhmmss_match[5]||'0',10)/3600
            ) * hours_to_milliseconds
        }

        // try to parse this as a date string:
        return (
            Date.parse(cleaned_value) ||
            Date.parse(        value)
        );

    }

    /**
     * return values that exist in the second argument but not the first
     *
     * @param {Array} list1 - first list of values
     * @param {Array} list2 - second list of values
     * @param {Array|function(*)} unique_id - function that returns the unique ID for a list item
     * @return {Array}
     * @protected
     *
     * @example
     *   let filtered = DiaryBase.unique(["a","b"],["b","c"],l=>l);
     *   -> ["c"]
     */
    static unique( list1, list2, unique_id ) {
        if ( typeof(unique_id) != "function" ) {
            const keys = unique_id;
            unique_id = r => keys.map( k => r[k] ).join("\uE000")
        }
        let list1_ids = {};
        list1.forEach( l => list1_ids[/** @type (function(*)) */(unique_id)(l)] = 1 );
        return list2.filter( l => !list1_ids.hasOwnProperty(/** @type (function(*)) */(unique_id)(l)) )
    }

    /**
     * Get the main object for managing timezones
     *
     * This object may change in future - prefer date() whenever possible.
     */
    static tc() {
        let ret;
        try {
            ret = self["tc"];
            if ( !ret ) throw "";
        } catch (e) {
            ret = require("timezonecomplete");
        }
        return ret;
    }

    /**
     * Create a DateTime object with timezone support
     *
     * @param {number|string} date - the date to parse
     * @param {string=} timezone - timezone (e.g. "Europe/London")
     * @public
     *
     * @example
     *   let date = DiaryBase.date(123456789,"Etc/GMT");
     */
    static date( date, timezone ) {
        const tc = DiaryBase.tc(),
              ret = new tc["DateTime"](date||0,tc["zone"]("Etc/UTC"));
        return timezone ? ret["toZone"](tc["zone"](timezone)) : ret;
    }

    /**
     * Get the time of the next DST change after the specified date
     *
     * @param {number|string} date - the date to parse
     * @param {string=} timezone - timezone (e.g. "Europe/London")
     * @return {number} - tranisition time, or Infinity if no transitions are expected
     * @public
     */
    static next_dst_change( date, timezone ) {
        const tzdata = DiaryBase.tc()["TzDatabase"]["instance"]();
        /*
         * As of 2021-06-10, timezonecomplete has a weird bug
         * that causes it to miscalculate DST changes shortly before
         * the change itself.  This works around that issue:
         */
        for ( let time = date - 1000*60*60*48; time < date; time += 1000*60*60 ) {
            try {
                const ret = tzdata["nextDstChange"]( timezone, time );
                if ( !ret ) return Infinity;
                if ( ret > date ) return ret;
            } catch ( e ) {
                /*
                 * timezonecomplete has been seen to throw timezonecomplete.InvalidTimeZoneData
                 * when calling e.g. tzdata["nextDstChange"]( "Europe/London", 0 )

                 */
                return Infinity;
            }
        }
        return tzdata["nextDstChange"]( timezone, date ) || Infinity;
    }

    /**
     * Array of status strings and associated regular expressions
     * @protected
     */
    static status_matches() {
        return [
            /* status       must match                 style (BG, FG, text) */
            [ "awake"     , "w.ke"                    , ""                    ],
            [ "asleep"    , "sle*p(?!.*aid)"          , "#FFFFFF00,#FF0000FF,#FFFFFFFF" ],
            [ "lights off", "light.*(?:out|off)"      , "#FFFFFFFF,#FF000080,#FFFFFFFF" ],
            [ "lights on" , "light.*on"               , "#FFFFFFFF,#FFE6E6FF" ],
            [ "snack"     , "snack"                   , "#FFFF7FFF,#FF7FFF7F" ],
            [ "meal"      , "meal|eat"                , "#FFFF00FF,#FF00FF00" ],
            [ "alcohol"   , "alco"                    , "#FF1FAFEF,#FFE05010,#FFFFFFFF" ],
            [ "chocolate" , "choc"                    , "#FF84C0FF,#FF7B3F00,#FFFFFFFF" ],
            [ "caffeine"  , "caffeine|coffee|tea|cola", "#FF0B3B8B,#FFF4C474" ],
            [ "drink"     , "drink"                   , "#FFDF8F5F,#FF2070a0,#FFFFFFFF" ],
            [ "sleep aid" , "sle*p.*aid|pill|tranq"   , "#FFAFFF7F,#FF500080,#FFFFFFFF" ],
            [ "exercise"  , "exercise"                , "#FF00C0C0,#FFFF3F3F" ],
            [ "toilet"    , "toilet|bathroom|loo"     , "#FF363636,#FFC9C9C9" ],
            [ "noise"     , "noise"                   , "#FF8F8F8F,#FF707070,#FFFFFFFF" ],
            [ "alarm"     , "alarm"                   , "#FF000000,#FFFF0000" ],
            [ "in bed"    , "down|(in|to).*bed"       , "#FFA0A000,#FF5f5fff" ],
            [ "out of bed", "up|out.*bed"             , "#FF0000FF,#FFFFFFCC" ],
        ];
    }

    /**
     * Complete list of allowed timezones
     * @return {Array<string>}
     */
    ["timezones"]() {
        return Object.keys(self["tzdata"]["zones"]).sort();
    }

    /**
     * Version ID for this package
     * @return {string}
     */
    ["software_version"]() { return SOFTWARE_VERSION; }

}

/**
 * Low-level reader interface
 *
 * @public
 *
 * @throws Will throw an error for unrecognised documents
 *
 * @param {string|Object} file - file contents, or filename/contents pairs (for archive files)
 * @param {Function=} serialiser - function to serialise output
 *
 * @return {Object|null} diary, or null if the document could not be parsed
 *
 * @example
 *   let diary = new_sleep_diary(contents_of_my_file));
 */
function new_sleep_diary(file,serialiser) {

    let error = new Error("This does not appear to be a sleep diary");

    let file_format = file["file_format"];

    if ( typeof(file) == "string" ) {

        file_format = "string";
        file = { "file_format": () => "string", "contents": file };

    } else if ( file_format ) {

        if ( typeof(file_format) == "string" ) {
            file["file_format"] = () => file_format;
        } else {
            file_format = file_format();
        }

        if ( file_format == "url" ) {
            file["contents"] = JSON.parse(decodeURIComponent(file["contents"].replace(/^sleep-?diary=/,'')));
        } else if ( file_format == "storage-line" ) {
            // these two formats behave identically after this point:
            file_format = "url";
        }

    } else {

        throw error;

    }

    if ( file_format == "string" ) {
        Object.assign(file,Spreadsheet.parse_csv(file["contents"]));
    }

    for ( let n=0; n!=sleepdiary_engines.length; ++n ) {
        try {
            return new sleepdiary_engines[n]["constructor"](file,serialiser);
        } catch (e) {
            if ( e ) { // SleepDiary.invalid() throws null to indicate the file is in the wrong format
                if ( DEBUG ) console.error(e);
                error = e;
            }
        }
    }

    if ( DEBUG ) {
        // this can cause false positives when e.g. DiaryLoader calls it on an ArrayBuffer,
        // before converting the file to text
        console.error( "Failed to read sleep diary", file, error );
    }
    throw error;

};
