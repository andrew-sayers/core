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
 *        "start": 12345678,
 *        "end"  : 23456789,
 *        "status": "asleep",
 *        "comments": [ "comment 1", "comment 2" ],
 *      },
 *      ...
 *    ]
 *
 */
class DiarySpreadsheetGraph extends DiaryBase {

    /**
     * @param {Object} file - file contents
     * @param {Function=} serialiser - function to serialise output
     */
    constructor(file,serialiser) {

        super(file,serialiser);

        const status_matches = DiaryBase.status_matches();

        let records;
        let status_map = {};

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
                            "member": "status",
                            "type": "text",
                        },
                        {
                            "members": [ "comments" ],
                            "export": (array_element,row,offset) => row[offset] = Spreadsheet.create_cell( array_element["comments"].join("; ") ),
                            "import": (array_element,row,offset) => array_element["comments"] = row[offset]["value"].split(/\s*;\s*/),
                        },
                    ],
                },
            ],
        );

        if ( file["sheets"] && file["sheets"][0] && file["sheets"][0]["cells"] ) {

            const      twelve_hours = 12 * 60 * 60 * 1000;
            const twenty_four_hours = 24 * 60 * 60 * 1000;
            const cells = file["sheets"][0]["cells"];

            /*
             * Calculate headers
             */

            let headers = {
                col: 0,
                row: 0,
            };

            const first_row = cells[0].map(
                value => Spreadsheet.parse_timestamp(value,file["spreadsheet"])
            );
            const first_col = cells.map(
                value => Spreadsheet.parse_timestamp(value[0],file["spreadsheet"])
            );

            let first_styled_col = Infinity,
                 last_styled_col = 0,
                first_styled_row = Infinity,
                 last_styled_row = 0
            ;
            cells.forEach(
                (row,r) => row.forEach( (v,c) => {
                    if ( v["style"] ) {
                        first_styled_col = Math.min( first_styled_col, c );
                         last_styled_col = Math.max(  last_styled_col, c );
                        first_styled_row = Math.min( first_styled_row, r );
                         last_styled_row = Math.max(  last_styled_row, r );
                    }
                })
            );

            // find the longest run of numbers in the first column/row:
            const longest_runs = (
                [ first_row, first_col ]
                .map( line => {

                    let runs = (typeof(line[0])=="number" && !isNaN(line[0])) ? [[0,line[0]]] : [ [1] ];
                    for ( let n=1; n<line.length; ++n ) {

                        // fix e.g. "8pm 9 10pm":
                        if ( line[n-1] >= twelve_hours && line[n] < twelve_hours ) {
                            line[n] += twelve_hours;
                        }

                        if ( typeof(line[n]) == "number" && !isNaN(line[n]) ) {
                            runs[runs.length-1].push(line[n]);
                        } else {
                            runs.push([n+1]);
                        }

                    }

                    const longest_run = runs
                          .sort( (a,b) => b.length - a.length )
                    [0];

                    const times = longest_run.slice(1);

                    let run_type;
                    if ( times.length > 4 ) {
                        if ( times.some( v => v < 0 || v >= twenty_four_hours ) ) {
                            run_type = 1; // date
                        } else if ( times.length > 23 ) {
                            run_type = 2; // time
                        }
                    } else {
                        const now = new Date().getTime();
                        if ( times.length && times.every( v => v >= twenty_four_hours && v <= now ) ) {
                            run_type = 1; // date
                        }
                    }

                    return {
                        lines: 1,
                        start: longest_run[0],
                        times: times,
                        type : run_type,
                    };

                })
            );

            // calculate explicit headers:
            switch ( longest_runs[0].type ) {

            case 0: // first row is unknown
                if ( longest_runs[1].type ) { // first column is known
                    headers.col = longest_runs[1];
                }
                break;

            case 1: // first row is a date header
                switch ( longest_runs[1].type ) {
                case 2: // first column is a time header
                    headers.col = longest_runs[1];
                    // fall through
                case 0: // first column is unknown
                    headers.row = longest_runs[0];
                    break;
                default: // both headers are date headers
                    if ( longest_runs[0].times.length > longest_runs[1].times.length ) {
                        headers.row = longest_runs[0];
                    } else {
                        headers.col = longest_runs[1];
                    }
                }
                break;

            case 2: // first row is a time header
                switch ( longest_runs[1].type ) {
                case 1: // first column is a date header
                    headers.col = longest_runs[1];
                    // fall through
                case 0: // first column is unknown
                    headers.row = longest_runs[0];
                    break;
                default: // both headers are time headers
                    if ( (longest_runs[0].times.length%24) < (longest_runs[1].times.length%24) ) {
                        headers.row = longest_runs[0];
                    } else {
                        headers.col = longest_runs[1];
                    }
                }
                break;

            }

            // guess implicit headers:

            if ( !headers.row ) {
                const offset = headers.col?1:0;
                if (
                    offset
                    ? headers.col.type == 1 // col is a date header, so this must be time
                    : first_row.length >= 24 // col is empty and this is long enough to be a time
                ) {
                    let times = [];
                    const length = first_row.length - offset;
                    const length_24 = length - (length%24);
                    for ( let n=0; n!=length_24; ++n ) times.push( n * (twenty_four_hours)/length_24 );
                    headers.row = {
                        lines: 0,
                        start: offset,
                        times: times,
                        type : 2,
                    };
                } else {
                    // col is a time header, so this must be date
                    let times = [];
                    const length = first_row.length - offset;
                    const now = new Date().getTime();
                    const today = now - ( now % (twenty_four_hours) );
                    for ( let n=Math.max( offset+1, first_styled_col ); n <= last_styled_col; ++n ) {
                        times.push( today - (last_styled_col-n) * (twenty_four_hours) );
                    }
                    headers.row = {
                        lines: 0,
                        start: offset,
                        times: times,
                        type : 2,
                    };
                }
            }

            if ( !headers.col ) {
                const offset = headers.row.lines;
                if ( headers.row.type == 1 ) { // col must be a time header
                    let times = [];
                    const length = first_col.length - offset;
                    const length_24 = length - (length%24);
                    for ( let n=0; n!=length_24; ++n ) times.push( n * (twenty_four_hours)/length_24 );
                    headers.col = {
                        lines: 0,
                        start: offset,
                        times: times,
                        type : 2,
                    };
                } else {
                    // row is a time header, so this must be date
                    let times = [];
                    const length = first_col.length - offset;
                    const now = new Date().getTime();
                    const today = now - ( now % (twenty_four_hours) );
                    const start = Math.max( offset, first_styled_row );
                    for ( let n=start; n <= last_styled_row; ++n ) {
                        times.push( today - (last_styled_row-n) * (twenty_four_hours) );
                    }
                    headers.col = {
                        lines: 0,
                        start: start,
                        times: times,
                        type : 2,
                    };
                }
            }
            if ( !headers.row.times.length || !headers.col.times.length ) return this.invalid(file);

            /*
             * Convert data to sleep diary
             */

            let segments = [];
            headers.col.times.forEach( (col_offset,r) => {
                const col = cells[headers.col.start+r];
                headers.row.times.forEach( (row_offset,c) => {
                    const cell = col[headers.row.start+c] || { "style": "" };
                    segments.push({
                        "start": col_offset + row_offset,
                        "style": cell["style"]||"",
                        "comments": cell["value"] ? [ cell["value"] ] : [],
                    });
                })
            });
            if ( !segments.length ) return this.invalid(file);
            segments = segments.sort( (a,b) => a.start - b.start );

            records = [
                { "style": NaN }, // dummy value, removed later
            ];
            segments
                .forEach(segment => {
                    if ( segment["style"] == records[records.length-1]["style"] ) {
                        records[records.length-1]["comments"] = (
                            records[records.length-1]["comments"].concat( segment["comments"] )
                        );
                    } else {
                        records[records.length-1]["end"] = segment["start"] - 1;
                        records.push(segment);
                    }
                });
            //records[records.length-1]["end"] = (Math.floor(segments[segments.length-1]["start"]/(twenty_four_hours))+1)*(twenty_four_hours)-1; // NO!  Event is still ongoing
            records.shift();

            let styles = {};
            records.forEach( record => {
                const style = styles[record["style"]] = styles[record["style"]] || { records: [], duration: 0 };
                style.records.push( record );
                if ( record["end"] && record["start"] ) {
                    style.duration += record["end"] - record["start"];
                }
            });

            /*
             * Look for legend text
             */

            let legend_styles = [];
            let legend_texts  = [];
            cells.forEach( (row,r) => {
                row.forEach( (cell,c) => {
                    if (
                           r <  headers.col.start - headers.row.lines
                        || r >= headers.col.start+headers.col.times.length
                        || c <  headers.row.start - headers.col.lines
                        || c >= headers.row.start+headers.row.times.length
                    ) {
                        if ( cell["value"] ) legend_texts .push( [ r, c, cell["value"] ] );
                        if ( cell["style"] ) legend_styles.push( [ r, c, cell["style"] ] );
                    }
                });
            });

            let legend = [];
            legend_styles.forEach(
                style => legend = legend.concat( legend_texts.map( text => [
                    Math.abs(text[0]-style[0]) + Math.abs(text[1]-style[1]),
                    style[2],
                    text [2],
                ]) )
            );

            /*
             * Assign statuses to styles
             */

            let unused_statuses = {};
            status_matches.forEach( m => unused_statuses[m[0]] = new RegExp(m[1],'i') );

            // explicit statuses:
            let legend_seen_texts = {};
            legend
                .sort( (a,b) => a[0] - b[0] )
                .forEach( l => {
                    if ( styles[l[1]] && !legend_seen_texts[l[2]] ) {
                        legend_seen_texts[l[2]] = 1;
                        let status = (
                            Object.keys(unused_statuses)
                                .find( key => l[2].search(unused_statuses[key]) != -1 )
                        );
                        if ( status ) {
                            delete unused_statuses[status];
                        } else {
                            status = l[2];
                        }
                        status_map[status] = l[1];
                        styles[l[1]].records.forEach( record => {
                            delete record["style"];
                            record["status"] = status;
                        });
                        delete styles[l[1]];
                    }
                })
            ;

            // Add implicit statuses
            let unknown_statuses = 0;
            Object.values(styles)
                .sort( (a,b) => b.duration - a.duration )
                .forEach( style => {
                    let status = status_matches.find( s => unused_statuses[s[0]] );
                    if ( status ) {
                        status = status[0];
                        delete unused_statuses[status];
                    } else {
                        status = "Unknown status #" + (++unknown_statuses);
                    }
                    style.records.forEach( record => {
                        status_map[status] = record["style"];
                        record["status"] = status;
                        delete record["style"];
                    });
                });

        } else if ( this.initialise_from_common_formats(file) ) {

            return;

        } else {

            records = (
                file["to"]("Standard")["records"]
                    .map( record => {
                        let ret = { "comments": [] };
                        [ "start", "end", "status", "comments" ].forEach(
                            m => record.hasOwnProperty(m) && ( ret[m] = record[m] )
                        );
                        status_map[record["status"]] = status_matches.find( s => s[0] == record["status"] )[2];
                        return ret;
                    })
            );

        }

        /**
         * Individual records from the sleep diary
         * @type {Array}
         */
        this["records"] = records;

        /**
         * Map status strings to styles
         * @type {Object}
         */
        this["status_map"] = status_map;

    }

    ["to"](to_format) {

        switch ( to_format ) {

        case "output":
            throw Error("Please use to_async() to generate output for SpreadsheetGraph");

        case "Standard":
            return new DiaryStandard({ "records": this["records"] },this.serialiser);

        default:

            return super["to"](to_format);

        }

    }

    ["to_async"](to_format) {

        switch ( to_format ) {

        case "output":

            const one_minute        =           60 * 1000;
            const twenty_four_hours = 24 * 60 * 60 * 1000;

            const records    = this["records"];
            const status_map = this["status_map"];

            // find the longest duration that all records are divisible by:
            const cell_duration = (
                [ 60, 30, 15, 5 ]
                    .map( cd => cd*one_minute )
                    .find(
                        cd => !records.filter( r => r["start"] % cd ).length
                    )
                || 5*one_minute
            );

            let min_day = Infinity;
            let max_day = 0;
            records.forEach( r => {
                min_day = Math.min( min_day, r["start"] );
                max_day = Math.max( max_day, r["end"  ]||(r["start"]+1) );
            });

            if ( min_day == Infinity ) min_day = max_day;

            min_day -= min_day % twenty_four_hours;
            max_day -= max_day % twenty_four_hours;

            const cells = [ [Spreadsheet.create_cell()] ];
            let number_formats = [ "YYYY-MM-DD" ],
                widths = [ 11 ],
                styles = [ { "font": { "size": 10 } } ]
            ;

            // Add headers
            for ( let n=0; n!=twenty_four_hours; n += cell_duration ) {
                cells[0].push( Spreadsheet.create_cell(n/twenty_four_hours,"#FFEEEEEE,#FFEEEEEE") )
                number_formats.push("H:MM");
                widths.push(5);
                styles.push( { "font": { "size": 10 } } );

            };
            for ( let n=min_day; n<=max_day; n += twenty_four_hours ) {
                cells.push( [Spreadsheet.create_cell(new Date(n),"#FFEEEEEE,#FFEEEEEE")] )
            };

            // Add body:
            records.forEach( r => {

                const start = r["start"];
                const end   = r["end"  ]||(start+1);
                const style = status_map[r["status"]];

                const cell_count = Math.max( ( end - start ) / cell_duration );

                const comments = (r["comments"]||[]).slice(0);
                const comments_per_cell = Math.ceil( comments.length / cell_count );

                for ( let n = start; n < Math.max(end,start+1); n += cell_duration ) {
                    const time = n % twenty_four_hours;
                    const date = n - time;
                    cells
                        [ ( date - min_day ) / twenty_four_hours + 1 ]
                        [ Math.floor( time / cell_duration ) + 1 ]
                        = Spreadsheet.create_cell(
                            comments.splice( 0, comments_per_cell ).join("; "),
                            style
                        );
                }

            });

            // Add legend:

            let legend = {};
            records.forEach( r => {
                const record_status = r["status"];
                if ( status_map[record_status] ) {
                    let item = legend[record_status] = legend[record_status] || [ 0, status_map[record_status], record_status ];
                    item[0] += r["end"] - r["start"];
                }
            });

            Object.values(legend)
                .sort( (a,b) => b[0] - a[0] )
                .forEach( (item,n) => {
                    let row = cells[ n + 1 ] = cells[ n + 1 ] || [];
                    row[ cells[0].length + 2 ] = Spreadsheet.create_cell(undefined,item[1]);
                    row[ cells[0].length + 3 ] = Spreadsheet.create_cell(item[2]);
                });

            this["spreadsheet"]["sheets"][0] = {
                "name": "Sleep Graph",
                "number_formats": number_formats,
                "cells": cells,
                "widths": widths,
                "styles": styles,
                "options": {
                    "properties" : {
                        "defaultRowHeight": 12.5,
                    },
                    "pageSetup" : {
                        "paperSize" : 9, // A4
                        "orientation" : "landscape",
                    },
                }
            };

            return this["spreadsheet"]["serialise"]().then(
                contents => this.serialise({
                    "file_format": () => "array",
                    "contents": contents,
                })
            );

        default:

            return super["to_async"](to_format);

        }

    }

    ["merge"](other) {

        other = other["to"](this["file_format"]());

        function create_id(record) {
            return (
                [ "status", "start", "end" ]
                .map( member => record[member] )
                .join()
            );
        }

        let existing_ids = {};
        this["records"].forEach( r => existing_ids[create_id(r)] = 1 );

        this["records"] = this["records"].concat(
            other["records"].filter( r => !existing_ids.hasOwnProperty(create_id(r)) )
        );

        const other_status_map = other["status_map"];
        let         status_map = this ["status_map"];
        Object.keys(other_status_map)
            .forEach( status => {
                if ( !status_map.hasOwnProperty(status) ) {
                    status_map[status] = other_status_map[status];
                }
            });

        return this;

    }

    ["file_format"]() { return "SpreadsheetGraph"; }
    ["format_info"]() {
        return {
            "name": "SpreadsheetGraph",
            "title": "Spreadsheet Graph",
            "url": "/src/SpreadsheetGraph",
            "extension": ".xlsx",
            "icon": "mdi-file-excel-outline"
        }
    }

}

DiaryBase.register(DiarySpreadsheetGraph);
