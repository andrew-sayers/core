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
 * console.log(diary.records);
 * -> [
 *      {
 *        start: 12345678,
 *        end: 23456789,
 *        "forced awakening": true,
 *        "delayed retirement": false,
 *      },
 *      ...
 *    ]
 */
class DiarySleepChart1 extends DiaryBase {

    /**
     * @param {Object} file - file contents
     * @param {Function=} serialiser - function to serialise output
     */
    constructor(file,serialiser) {

        super(file,serialiser);

        /*
         * PROPERTIES
         */

        let records = [];

        /**
         * Spreadsheet manager
         * @protected
         * @type {Spreadsheet}
         */
        this["spreadsheet"] = new Spreadsheet(
            this,
            [
                {
                    "sheet" : "Records",
                    "member" : "records",
                    "cells": [
                        {
                            "member": "start",
                            "type": "time",
                        },
                        {
                            "member": "end",
                            "type": "time",
                        },
                        {
                            "member": "forced awakening",
                            "type": "boolean",
                        },
                        {
                            "member": "delayed retirement",
                            "type": "boolean",
                        },
                    ]
                }
            ]
        );

        /*
         * CONSTRUCT FROM DIFFERENT FORMATS
         */

        switch ( file["file_format"]() ) {

        case "array":

            function to_unix_time(time) {
                /*
                 * times are represented as a 32-bit float number of days.
                 * The official program only offers one-minute granularity,
                 * so we round numbers to the nearest minute.
                 */
                const epoch = 15776640; // Fri 31 Dec 00:00:00 GMT 1999, in minutes
                const minutes_per_day = 60*24;
                const ms_per_minute = 60*1000;
                return Math.round( epoch + time * minutes_per_day ) * ms_per_minute;
            }

            const buffer = file["contents"];

            if ( buffer.byteLength % 12 ) return this.invalid(file);

            const float_data = new Float32Array(buffer);
            const uint8_data = new Uint8Array(buffer);

            let prev_end = 1.0;
            for ( let n=0; n<buffer.byteLength/12; ++n ) {
                const start = float_data[n*3+0];
                const end   = float_data[n*3+1];
                const forced_awakening   = !uint8_data[n*12+8];
                const delayed_retirement = !uint8_data[n*12+9];
                if ( start < prev_end || end <= start ) return this.invalid(file);
                prev_end = end;
                records.push({
                    "start": to_unix_time(start),
                    "end"  : to_unix_time(end),
                    "forced awakening"  : forced_awakening,
                    "delayed retirement": delayed_retirement,
                });
            }

            break;

        default:

            if ( this.initialise_from_common_formats(file) ) return;

            records =
                file["to"]("Standard")["records"]
                .filter( r => r["status"] == "asleep" )
                .map( r => ({
                    "start": r["start"],
                    "end"  : r["end"],
                    "forced awakening"  : (r["tags"]||[]).some( t => t.search(/forced awakening/i  ) != -1 ),
                    "delayed retirement": (r["tags"]||[]).some( t => t.search(/delayed retirement/i) != -1 ),
                }));

            break;

        }

        /**
         * Individual records from the sleep diary
         * @type {Array}
         */
        this["records"] = records;

    }

    ["to"](to_format) {

        switch ( to_format ) {

        case "output":

            const epoch = 946598400000; // Fri 31 Dec 00:00:00 GMT 1999
            const one_day_in_ms = 86400000;

            let float_data = new Float32Array(this["records"].length*3);
            let uint8_data = new Uint8Array(float_data.buffer);
            this["records"].forEach( (r,n) => {
                float_data[n*3+0] = ( r["start"] - epoch ) / one_day_in_ms;
                float_data[n*3+1] = ( r["end"  ] - epoch ) / one_day_in_ms;
                uint8_data[n*12+8] = r["forced awakening"  ] ? 0x00 : 0xFF;
                uint8_data[n*12+9] = r["delayed retirement"] ? 0x00 : 0xFF;
            });

            return this.serialise({
                "file_format": () => "array",
                "contents": float_data.buffer
            });

        case "Standard":

            return new DiaryStandard({
                "records": this["records"].map( r => ({
                    "status": "asleep",
                    "start": r["start"],
                    "end"  : r["end"],
                    "tags": [].concat(
                        r["forced awakening"  ] ? ["forced awakening"  ] : [],
                        r["delayed retirement"] ? ["delayed retirement"] : [],
                    ),
                }))
            }, this.serialiser);

        default:

            return super["to"](to_format);

        }

    }

    ["merge"](other) {

        other = other["to"](this["file_format"]());

        let prev_end = 1.0;
        this["records"] = this["records"]
            .concat( other["records"] )
            .sort( (a,b) => a["start"] - b["start"] )
            .filter( r => {
                if ( r.start < prev_end || r.start >= r.end ) return false;
                prev_end = r.end;
                return true;
            })
        ;

        return this;

    }

    ["file_format"]() { return "SleepChart1"; }
    ["format_info"]() {
        return {
            "name": "SleepChart1",
            "title": "SleepChart 1.0",
            "url": "/src/SleepChart1",
            "statuses": [ "asleep" ],
            "extension": ".tim",
            "logo": "https://www.supermemo.com/assets/images/frontpage2/intro/icon4.svg",
        }
    }

}

DiaryBase.register(DiarySleepChart1);
