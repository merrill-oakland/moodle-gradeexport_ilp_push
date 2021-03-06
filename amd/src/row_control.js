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
 * Javascript dealing with each grading row.
 *
 * @module     gradeexport_ilp_push/row_control
 * @package    gradeexport_ilp_push
 * @author     Eric Merrill (merrill@oakland.edu)
 * @copyright  2019 Oakland University (https://www.oakland.edu)
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

define(['jquery', 'gradeexport_ilp_push/page_info', 'core/ajax', 'core/notification', 'core/templates', 'core/str', 'core/log'],
        function($, pageInfo, ajax, notification, templates, str, log) {

    var RowController = {
        failGrades: false,
        incompleteGrades: false,

        initAll: function() {
            $('.gradingtable .usergraderow').each(function() {
                RowController.initRow($(this));
            });
        },

        initRow: function(row) {
            var select = row.find('.gradeselect').eq(0);

            select.change(function() {
                var key = $(this).val();
                if (pageInfo.gradeIsIncomplete(key)) {
                    row.find('.incomplete').show();
                } else {
                    row.find('.incomplete').hide();
                }
                if (pageInfo.gradeRequiresLastAttend(key)) {
                    row.find('.lastattend').show();
                } else {
                    row.find('.lastattend').hide();
                }

                RowController.updateVerification(row);

            });

            row.find('.incompletedeadline input').eq(0).change(function() {
                RowController.updateVerification(row);
            });

            row.find('.datelastattended input').eq(0).change(function() {
                RowController.updateVerification(row);
            });

            row.find('.incompletegradeselect').eq(0).change(function() {
                RowController.updateVerification(row);
            });

            row.find('.grademode .currentgrademode').eq(0).click(function() {
                RowController.showGradeModeSelector(row);
            });

            row.find('.grademode .grademodeselect').eq(0).change(function() {
                RowController.changeGradeMode(row);
            });

            row.find('.grademode .grademodeselect').eq(0).focusout(function() {
                RowController.hideGradeModeSelector(row);
            });

            row.find('.togglehistory a').eq(0).click(function(event) {
                event.preventDefault();
                RowController.toggleHistory(row);
            });

            RowController.updateVerification(row);
        },

        updateFormWarning: function(row, elementSelect, strName, strData) {
            var element = row.find(elementSelect);

            if (!element) {
                return;
            }
            // Get the first element out of the array.
            element = element.eq(0);
            if (!strName) {
                element.html('');
                return;
            }

            str.get_string(strName, 'gradeexport_ilp_push', strData).done(function(errorstr) {
                templates.renderPix('i/warning', 'core', errorstr)
                .then(function(html) {
                    // For some reason can't get replaceNodeContents to work without js...
                    // templates.replaceNodeContents(gradeerror, html);
                    element.html(html);
                    return;
                })
                .fail(function() {
                    log.debug("Failed to fetch the warning icon");
                });
            });
        },

        updateVerification: function(row) {
            if (row.hasClass('locked')) {
                // We don't do anything with locked rows.
                return;
            }

            var select = row.find('.gradeselect').eq(0);
            var key = select.val();
            var confirm = row.find('.confirmcheckbox').eq(0);

            var defaultGrade = row.find('.grade .letter').eq(0).data('grade-key');
            var inequal = row.find('.grade .notequal').eq(0);

            if (defaultGrade != key) {
                inequal.show();
            } else {
                inequal.hide();
            }

            var date = false,
                disable = false;

            var errorCode = '';
            if (!key) {
                disable = true;

                errorCode = 'invalid_grade';
            }
            RowController.updateFormWarning(row, '.gradeerror', errorCode);

            if (pageInfo.gradeIsIncomplete(key)) {
                date = row.find('.incompletedeadline input').eq(0);

                errorCode = '';
                if (date.val() == '') {
                    disable = true;
                    errorCode = 'invalid_incomplete_date';
                } else if (!pageInfo.isAllowedIncompleteDeadline(date.val())) {
                    disable = true;
                    errorCode = 'invalid_incomplete_date';
                }

                if (errorCode != '') {
                    errorCode = pageInfo.getIncompleteDeadlineStringName();
                }
                RowController.updateFormWarning(row, '.incompletedateerror', errorCode, pageInfo.getStringIncompleteDeadline());

                var incompleteSelect = row.find('.incompletegradeselect').eq(0);
                errorCode = '';

                if (!incompleteSelect.val()) {
                    disable = true;
                    errorCode = 'invalid_incomplete_grade_missing';
                } else if (!pageInfo.isAllowedIncompleteGrade(incompleteSelect.val())) {
                    disable = true;
                    errorCode = 'invalid_incomplete_grade_wrong';
                }

                RowController.updateFormWarning(row, '.incompletegradeerror', errorCode, pageInfo.getIncompleteGrade());
            }
            if (pageInfo.gradeRequiresLastAttend(key)) {
                date = row.find('.datelastattended input').eq(0);

                errorCode = '';
                if (date.val() == '') {
                    disable = true;
                    errorCode = 'invalid_datelastattended';
                } else if (!pageInfo.isAllowedLastAttendDate(date.val())) {
                    disable = true;
                    errorCode = 'invalid_datelastattended';
                }

                RowController.updateFormWarning(row, '.datelastattendederror', errorCode, pageInfo.getStringLastAttendDates());
            }

            if (disable) {
                confirm.prop("disabled", true);
            } else {
                confirm.prop("disabled", false);
            }
            return;
        },

        showGradeModeSelector: function(row) {
            var currentGradeMode = row.find('.grademode .currentgrademode');
            var selector = row.find('.grademode .grademodeselect');

            currentGradeMode.hide();
            selector.show();
        },

        hideGradeModeSelector: function(row) {
            var currentGradeMode = row.find('.grademode .currentgrademode');
            var selector = row.find('.grademode .grademodeselect');

            currentGradeMode.show();
            selector.hide();
        },

        changeGradeMode: function(row) {
            var currentGradeMode = row.find('.grademode .currentgrademode');
            var selector = row.find('.grademode .grademodeselect');

            var newGradeModeId = selector.find('select').eq(0).val();
            var studentId = row.data('user-id');
            var rowId = row.data('row-id');
            var courseId = row.closest('form').find('input[name="courseid"]').val();

            ajax.call([{
                methodname: 'gradeexport_ilp_push_update_row_grade_mode',
                args: {rowid: rowId, grademodeid: newGradeModeId, studentid: studentId, courseid: courseId},
                done: function(response) {
                    if (response.warnings.length > 0) {
                        notification.alert(
                            response.warnings[0].message,
                            response.warnings[0].item
                        );

                        currentGradeMode.show();
                        selector.hide();

                        return;
                    }
                    templates.render('gradeexport_ilp_push/user_row', JSON.parse(response.rowdata))
                        .then(function(html, js) {
                            // Find any neighboring status rows and remove them.
                            row.siblings('tr[data-row-id="' + rowId + '"]').remove();
                            templates.replaceNode(row, html, js);
                            row = $('.gradingtable .usergraderow[data-row-id="' + rowId + '"]').eq(0);
                            RowController.initRow(row);
                            return null;
                        }).fail(function(ex) {
                            notification.exception(ex);
                        });

                },
                fail: notification.exception
            }]);

        },

        toggleHistory: function(row) {
            var historyTd = $('#historyrow-' + row.data('row-id') + ' td.historycell');
            var historyDiv = historyTd.find('.historydiv');

            if (historyTd.is(":hidden")) {
                historyTd.slideDown(100);
                historyDiv.slideDown(400);
            } else {
                historyDiv.animate({height: 0}, 400, function() {
                    historyDiv.hide();
                    historyDiv.height('auto');
                });
                historyTd.hide(400);
            }
        }
    };

    return RowController;
});
