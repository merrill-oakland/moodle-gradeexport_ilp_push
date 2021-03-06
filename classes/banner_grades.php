<?php

// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <http://www.gnu.org/licenses/>.

/**
 * Deals with the interaction of banner grading.
 *
 * @package    gradeexport_ilp_push
 * @author     Eric Merrill (merrill@oakland.edu)
 * @copyright  2019 Oakland University (https://www.oakland.edu)
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace gradeexport_ilp_push;

defined('MOODLE_INTERNAL') || die();

use stdClass;
use gradeexport_ilp_push\local\data\grade_mode;
use gradeexport_ilp_push\local\sis_interface;

/**
 * Deals with the interaction of banner grading.
 *
 * @package    gradeexport_ilp_push
 * @author     Eric Merrill (merrill@oakland.edu)
 * @copyright  2019 Oakland University (https://www.oakland.edu)
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class banner_grades {

    protected static $failingids = null;

    protected static $requirelastdate = null;

    protected static $incompleteids = null;

    protected static $grademodes = null;

    protected static function load_grade_modes() {
        if (!is_null(self::$grademodes)) {
            return self::$grademodes;
        }
        self::$grademodes = grade_mode::get_for_params([], 'sortorder ASC');

        self::$failingids = [];
        self::$incompleteids = [];
        foreach (self::$grademodes as $grademode) {
            $options = $grademode->get_all_grade_options();
            foreach ($options as $option) {
                if (!empty($option->isincomplete)) {
                    self::$incompleteids[$option->id] = $option->id;
                }
                // TODO - need to update to isfailing.
                if (!empty($option->requirelastdate)) {
                    self::$failingids[$option->id] = $option->id;
                }
                if (!empty($option->requirelastdate)) {
                    self::$requirelastdate[$option->id] = $option->id;
                }
            }
        }
    }

    public static function get_grade_modes() {
        self::load_grade_modes();

        $output = [];
        foreach (self::$grademodes as $mode) {
            if (empty($mode->enabled)) {
                continue;
            }
            $output[$mode->id] = $mode;
        }

        return $output;
    }

    public static function get_grade_modes_menu() {
        $modes = self::get_grade_modes();

        $output = [];
        foreach (self::$grademodes as $mode) {
            $output[$mode->id] = $mode->name;
        }

        return $output;
    }

    public static function get_grade_mode($grademodeid, $default = true) {
        self::load_grade_modes();

        if (isset(self::$grademodes[$grademodeid])) {
            return self::$grademodes[$grademodeid];
        }

        // TODO - this should return null, not the top GM.
        if ($default) {
            return reset(self::$grademodes);
        } else {
            return null;
        }
    }

    public static function get_all_grade_modes() {
        self::load_grade_modes();

        return self::$grademodes;
    }

//     public static function get_possible_grades($userrow) {
//         $grademode = $userrow->get_current_grade_mode();
//
//
//         $gradeoptions = $grademode->get_current_grade_options();
//
//         $options = [];
//         foreach ($gradeoptions as $option) {
//             if (isset($option->displayname)) {
//                 $value = $option->displayname;
//             } else {
//                 $value = $option->bannervalue;
//             }
//             $options[$option->id] = $value;
//         }
//
//         return $options;
//
//         // TODO - Fallback to these defaults for old submissions.
//         $options = [1 => 'A',
//                     2 => 'A-',
//                     3 => 'B+',
//                     4 => 'B',
//                     5 => 'B-',
//                     6 => 'C+',
//                     7 => 'C',
//                     8 => 'C-',
//                     9 => 'D+',
//                     10 => 'D',
//                     11 => 'F',
//                     12 => 'I'];
//
//         return $options;
//     }

    public static function find_key_for_letter($letter) {
        // TODO - Redo/remove.

        return 0;

        $options = self::get_possible_grades();
        $key = array_search($letter, $options, true);

        if ($key === false) {
            return false;
        }

        return $key;
    }

    public static function get_banner_equivilant_grade($userrow) {
        // TODO - Better options here...

        $letter = $userrow->get_formatted_grade(GRADE_DISPLAY_TYPE_LETTER);

        return self::find_key_for_letter($letter);
    }

    public static function get_default_incomplete_grade() {
        // TODO - Redo.
        return 0;
        return self::find_key_for_letter('F');
    }

    public static function get_failing_grade_ids() {
        self::load_grade_modes();

        return self::$failingids;
    }

    public static function get_last_attend_required_ids(): ?array {
        self::load_grade_modes();

        return self::$failingids;
    }

    public static function get_incomplete_grade_ids() {
        self::load_grade_modes();

        return self::$incompleteids;
    }

    public static function get_allowed_last_attend_dates($course, $format = false, $tz = 99) {
        $dates = new stdClass();

        $dates->start = $course->startdate;

        if (empty($course->enddate)) {
            // We just have to guess. TODO better.
            $end = $course->startdate + (3600 * 24 * 7 * 16);
        } else {
            $end = $course->enddate;
        }

        if ($end > time()) {
            $end = time();
        }

        $dates->end = $end;

        if (!$format) {
            return $dates;
        }

        // Convert to a format.
        $dates->start = date_format_string($dates->start, $format, $tz);
        $dates->end = date_format_string($dates->end, $format, $tz);

        return $dates;
    }

    /**
     * Return the earliest and latest valid incomplete dates for the provided course.
     *
     * @param object $course The course object to reference.
     * @param string $format The strftime format string to use.
     * @param int $tz The timezone number to use.
     * @return object The return object with keys of 'start' and 'end' timestamps.
     *                Start set to 'false' will indicate before end (inclusive)
     *                End set to 'false' will indicate after start (inclusive)
     */
    public static function get_allowed_incomplete_deadline_dates($course, $format = false, $tz = 99) {
        $sis = sis_interface\factory::instance();

        // First see if there are SIS dates.
        $dates = $sis->get_allowed_last_incomplete_deadline_dates($course);

        // If that didn't return anything, then get settings date.
        if ($dates === false) {
            $dates = new stdClass();

            // Temp placeholder for 04/29/2022.
            $dates->start = 1651233600;
            $dates->end   = 1651233600;
        }

        // If we still don't have dates, we are going to make them up.
        if ($dates === false) {
            $dates = new stdClass();

            if (empty($course->enddate)) {
                // We just have to guess. TODO better.
                $courseend = $course->startdate + (3600 * 24 * 7 * 16);
            } else {
                $courseend = $course->enddate;
            }

            // The day after the end of the course is the first allowed date (I think TODO).
            $courseend += 3600 * 24;

            $dates->start = $courseend;

            $dates->end = $courseend + (3600 * 24 * 380);
        }

        if (!$format) {
            return $dates;
        }

        // Convert to a format.
        if ($dates->start !== false) {
            $dates->start = date_format_string($dates->start, $format, $tz);
        }
        if ($dates->end !== false) {
            $dates->end = date_format_string($dates->end, $format, $tz);
        }

        return $dates;
    }
}
