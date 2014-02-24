HrDashboard = window.HrDashboard || {};

(function() {
    var self = this;

    var fiscalYearStartMonth = 11;

    self.allEmployeesEnumerable = null;
    self.employeeMetadata = null;
    self.employeeTrailMetadata = null;
    
    self.allEventsEnumerable = null;
    self.eventMetadata = null;

    self.pulseOptionsEnumerable = null;
    self.benefitOptionsEnumerable = null;
    self.eventTypesEnumerable = null;
    self.eventMonths = [];

    self.allEmployees = [];
    self.filteredAllEmployees = ko.observable([]);
    
    self.allActiveEmployees = [];
    self.filteredActiveEmployees = ko.observable([]);
    
    self.taskMetadata = null;
    self.allTasksEnumerable = null;
    self.allTasks = [];

    self.clientUrl = ko.observable("");
    self.employeeObjectTypeCode = ko.observable("");
    self.eventObjectTypeCode = ko.observable("");
    self.taskObjectTypeCode = ko.observable("");
    
    self.isLoading = ko.observable(false);

    // async methods
    self.refresh = function (loadData) {
        self.clientUrl(SDK.JQuery._getClientUrl());
        self.isLoading(true);
        async.auto({
                employees: function (callback) { getEmployeeData(callback, loadData); },
                employeeMetadata: function (callback) { getEmployeeEntityMetadata(callback, loadData); },
                employeeTrailMetadata: function (callback) { getEmployeeTrailEntityMetadata(callback, loadData); },
                events: function (callback) { getEventData(callback, loadData); },
                eventMetadata: function (callback) { getEventEntityMetadata(callback, loadData); },
                taskMetadata: function (callback) { getTaskEntityMetadata(callback, loadData); },
                tasks: ['taskMetadata', function (callback, results) {
                    getTaskData(callback, loadData, results.taskMetadata);
                }],
                
                benefitOptions: function (callback) { getBenefitData(callback, loadData); },

                managerFilter: ['employees', function(next, results) {
                    initializeManagerFilter(results.employees);
                    next();
                }],

                officeAndGroupFilter: ['employeeMetadata', function(next, results) {
                    initializeOfficeAndGroupFilters(results.employeeMetadata);
                    next();
                }],
                
                initializePulseOptions: ['employeeMetadata', function(next, results) {
                    initializePulseOptions(results.employeeMetadata);
                    next();
                }],

                initializeEventOptions: ['eventMetadata', function (next, results) {
                    initializeEventOptions(results.eventMetadata);
                    next();
                }],
                
                initializeTasks: ['tasks', 'taskMetadata', function (next, results) {
                    initializeTasks(results.tasks, results.taskMetadata);
                    next();
                }],
                
                initializeEmployees: ['employees', 'employeeMetadata', 'employeeTrailMetadata', 'events', 'benefitOptions', 'initializePulseOptions', 'initializeEventOptions', function (next, results) {
                    initializeEmployees(results.employees, results.employeeMetadata, results.employeeTrailMetadata, results.events);
                    next();
                }],
                
                finish: ['initializeEmployees', 'initializeTasks', function (next, results) {
                    finish();
                    next();
                }]
            },
            function(err, results) {
                if (err) {
                    alert(err);
                }
            });

    };
    
    function finish() {
        self.clearFilters();
        self.isLoading(false);
    }

    function getEmployeeData(callback, refresh) {
        if (self.allEmployeesEnumerable && !refresh) {
            callback(null, self.allEmployeesEnumerable);
            return;
        }
        
        var employeeData = new Array();
        SDK.JQuery.retrieveMultipleRecords(
         "ihr_employee",
         "$select=ihr_employeeId,ihr_StartDate,ihr_EndDate,ihr_Office,ihr_Pulse,ihr_ManagerId,ihr_EmployeeStatus,statecode,statuscode,ihr_Group,ihr_fullname,ihr_ihr_employee_ihr_employeetrail,ihr_ihr_employee_ihr_benefit&$expand=ihr_ihr_employee_ihr_employeetrail,ihr_ihr_employee_ihr_benefit",

         function (employees) {
             employeeData = employeeData.concat(employees);
         },
         function (err) {
             callback(err, null);
         },
         function (completed) {
             var employeesEnumerable = Enumerable.From(employeeData);
             self.allEmployeesEnumerable = employeesEnumerable;
             callback(null, employeesEnumerable);
         }
       );
    }
    
    function getEmployeeEntityMetadata(callback, refresh) {
        if (self.employeeMetadata && !refresh) {
            callback(null, self.employeeMetadata);
            return;
        }

        SDK.Metadata.RetrieveEntity(SDK.Metadata.EntityFilters.Attributes, "ihr_employee", null, false, function (data) {
            self.employeeMetadata = data;
            callback(null, data);
        },
        function (err) {
            callback(err, null);
        });
    }
    
    function getEmployeeTrailEntityMetadata(callback, refresh) {
        if (self.employeeTrailMetadata && !refresh) {
            callback(null, self.employeeTrailMetadata);
            return;
        }

        SDK.Metadata.RetrieveEntity(SDK.Metadata.EntityFilters.Attributes, "ihr_employeetrail", null, false, function (data) {
            self.employeeTrailMetadata = data;
            callback(null, data);
        },
        function (err) {
            callback(err, null);
        });
    }
    
    function getEventData(callback, refresh) {
        if (self.allEventsEnumerable && !refresh) {
            callback(null, self.allEventsEnumerable);
            return;
        }

        var now = moment();
        var startDate = now.clone().startOf("day").startOf("month").subtract(3, "months");
        var startDateStr = "datetime'" + startDate.format("YYYY-MM-DD") + "T" + startDate.format("HH:mm:ss") + "Z'";
        var endDate = now.clone().endOf("day").startOf("month").add(2, "months").endOf("month").endOf("day");
        var endDateStr = "datetime'" + endDate.format("YYYY-MM-DD") + "T" + endDate.format("HH:mm:ss") + "Z'";
        
        var months = [startDate.clone()];
        for (var i = 1; ; i++) {
            var month = startDate.clone().add(i, "months");
            if (month.isAfter(endDate))
                break;
            months.push(month);
        }

        self.eventMonths = months;

        var eventData = new Array();
        SDK.JQuery.retrieveMultipleRecords(
         "ihr_event",
         "$select=ihr_Date,ihr_Type,ihr_eventId,ihr_IsSocialEvent,ihr_IsTouchpoint,ihr_ihr_employee_ihr_event&$expand=ihr_ihr_employee_ihr_event&$filter=ihr_Date ge " + startDateStr + " and ihr_Date le " + endDateStr,

         function (events) {
             eventData = eventData.concat(events);
         },
         function (err) {
             callback(err, null);
         },
         function (completed) {
             var eventEnumerable = Enumerable.From(eventData);
             self.allEventsEnumerable = eventEnumerable;
             callback(null, self.allEventsEnumerable);
         }
       );
    }
    
    function getEventEntityMetadata(callback, refresh) {
        if (self.eventMetadata && !refresh) {
            callback(null, self.eventMetadata);
            return;
        }

        SDK.Metadata.RetrieveEntity(SDK.Metadata.EntityFilters.Attributes, "ihr_event", null, false, function (data) {
            self.eventMetadata = data;
            callback(null, data);
        },
        function (err) {
            callback(err, null);
        });
    }
    
    function getTaskEntityMetadata(callback, refresh) {
        if (self.taskMetadata && !refresh) {
            callback(null, self.taskMetadata);
            return;
        }

        SDK.Metadata.RetrieveEntity(SDK.Metadata.EntityFilters.Attributes, "Task", null, false, function (data) {
            self.taskMetadata = data;
            callback(null, data);
        },
        function (err) {
            callback(err, null);
        });
    }
    
    function getTaskData(callback, refresh, taskMetadata) {
        if (self.allTasksEnumerable && !refresh) {
            callback(null, self.allTasksEnumerable);
            return;
        }

        self.taskObjectTypeCode(taskMetadata.ObjectTypeCode);

        var openTaskOption = Enumerable.From(Enumerable.From(taskMetadata.Attributes).Where('$.SchemaName === "StateCode"').Single().OptionSet.Options).Single('$.Label.UserLocalizedLabel.Label == "Open"').Value;
        
        var taskData = new Array();
        SDK.JQuery.retrieveMultipleRecords(
         "Task",
         "$select=ActivityId,Subject,StateCode,RegardingObjectId&$filter=RegardingObjectId ne null and StateCode/Value eq " + openTaskOption + "&$orderby=CreatedOn",

         function (tasks) {
             taskData = taskData.concat(tasks);
         },
         function (err) {
             callback(err, null);
         },
         function (completed) {
             var taskEnumerable = Enumerable.From(taskData);
             self.allTasksEnumerable = taskEnumerable;
             callback(null, self.allTasksEnumerable);
         }
       );
    }
    
    function getBenefitData(callback, refresh) {
        if (self.benefitOptionsEnumerable && !refresh) {
            callback(null, self.benefitOptionsEnumerable);
            return;
        }

        var benefitOptionsData = new Array();
        SDK.JQuery.retrieveMultipleRecords(
         "ihr_benefit",
         "$select=ihr_name,ihr_Rank&$orderby=ihr_Rank&$top=3",

         function (benefits) {
             benefitOptionsData = benefitOptionsData.concat(benefits);
         },
         function (err) {
             callback(err, null);
         },
         function (completed) {
             var defaults = [{ divId: "benefits1", benefitName: "MultiSport", color: "#77c06e" }, { divId: "benefits2", benefitName: "LUX MED", color: "#64c6e9" }, { divId: "benefits3", benefitName: "Life Insurance", color: "#ec7652" }];
             var benefitOptions = Enumerable.From(benefitOptionsData).Take(defaults.length).Select(function (x, i) {
                 var d = defaults[i];
                 d.benefitName = x.ihr_name;
                 return d;
             }).ToArray();
             self.benefitOptionsEnumerable = Enumerable.From(benefitOptions);
             callback(null, self.benefitOptionsEnumerable);
         }
       );
    }
    
    function initializeManagerFilter(employees) {
        var optionsManager = [new FilterOption("No manager", null)].concat(
            employees
            .GroupBy(function (x) { return x.ihr_ManagerId; }, function (x) { return { id: x.ihr_ManagerId.Id }; }, function (x, y) { return new FilterOption(x.Name ? x.Name : "No manager", x.Id); }, function (x) { return x.Id; })
            .Where("$.id() !== null")
            .ToArray());
        self.managerFilter().options(optionsManager);
    }
    
    function initializeOfficeAndGroupFilters(entityMetadata) {
        //Office
        var attOffice = Enumerable
            .From(entityMetadata.Attributes)
            .Where(function (x) { return x.SchemaName == "ihr_Office"; })
            .Single();

        var optionsOffice = [new FilterOption("No office", null)].concat(
            Enumerable.From(attOffice.OptionSet.Options)
            .Select(function (x) { return new FilterOption(x.Label.UserLocalizedLabel.Label, x.Value); })
            .ToArray());

        self.officeFilter().options(optionsOffice);

        //Group
        var attGroup = Enumerable
          .From(entityMetadata.Attributes)
          .Where(function (x) { return x.SchemaName == "ihr_Group"; })
          .Single();

        var optionsGroup = [new FilterOption("No group", null)].concat(
            Enumerable.From(attGroup.OptionSet.Options)
           .Select(function (x) { return new FilterOption(x.Label.UserLocalizedLabel.Label, x.Value); })
           .ToArray());

        self.groupFilter().options(optionsGroup);
    }
    
    function initializePulseOptions(entityMetadata) {
        var attPulse = Enumerable
         .From(entityMetadata.Attributes)
         .Where(function (x) { return x.SchemaName == "ihr_Pulse"; })
         .Single();

        var defaults = Enumerable.From([{ name: "Not Assessed", color: "#e3e3e3" }, { name: "Green", color: "#77c06e" }, { name: "Yellow", color: "#faf858" }, { name: "Orange", color: "#f6c35a" }, { name: "Red", color: "#ec7652" }]);
        var orderedPulse = Enumerable.From(attPulse.OptionSet.Options)
            .Select(function(x) {
                var s = defaults.FirstOrDefault(null, function (p) {
                    return p.name === x.Label.UserLocalizedLabel.Label;
                });

                var color = '#' + Math.floor(Math.random() * 16777215).toString(16);
                if(s)
                    color = s.color;
                
                return { name: x.Label.UserLocalizedLabel.Label, value: x.Value, color: color };
            })
            .ToArray();

        self.pulseOptionsEnumerable = Enumerable.From(orderedPulse);
    }
    
    function initializeEventOptions(eventMetadata) {
        self.eventObjectTypeCode(eventMetadata.ObjectTypeCode);
        
        var attType = Enumerable
         .From(eventMetadata.Attributes)
         .Where(function (x) { return x.SchemaName == "ihr_Type"; })
         .Single();

        var defaults = Enumerable.From([{ name: "Conference", color: "#77c06e" }, { name: "Executive Lunch/Dinner", color: "#b0d56e" }, { name: "Gift", color: "#ec7652" }, { name: "Offsite/Retreat", color: "#f6c35a" }, { name: "Lunch & Learn", color: "#64c6e9" },
        { name: "One-on-one", color: "#64c6e9" }, { name: "Promotion", color: "#f6c35a" }, { name: "Social Gathering", color: "#ec7652" }, { name: "Tech. Night", color: "#b0d56e" }, { name: "Training", color: "#77c06e" }]);
        var types = Enumerable.From(attType.OptionSet.Options)
            .Select(function (x) {
                var s = defaults.FirstOrDefault(null, function (p) {
                    return p.name === x.Label.UserLocalizedLabel.Label;
                });

                var color = '#' + Math.floor(Math.random() * 16777215).toString(16);
                if (s)
                    color = s.color;

                return { name: x.Label.UserLocalizedLabel.Label, value: x.Value, color: color };
            })
            .ToArray();

        self.eventTypesEnumerable = Enumerable.From(types);
    }
    
    function initializeEmployees(employees, employeeMetadata, employeeTrailMetadata, events) {
        self.employeeObjectTypeCode(employeeMetadata.ObjectTypeCode);
        
        var activeOption = Enumerable.From(Enumerable.From(employeeMetadata.Attributes).Where('$.SchemaName === "statecode"').Single().OptionSet.Options).Single('$.Label.UserLocalizedLabel.Label == "Active"').Value;
        
        var idcOption = Enumerable.From(Enumerable.From(employeeMetadata.Attributes).Where('$.SchemaName === "ihr_EmployeeStatus"').Single().OptionSet.Options).Single('$.Label.UserLocalizedLabel.Label == "IDC"').Value;
        var trailActiveOption = Enumerable.From(Enumerable.From(employeeTrailMetadata.Attributes).Where('$.SchemaName === "statecode"').Single().OptionSet.Options).Single('$.Label.UserLocalizedLabel.Label == "Active"').Value;
        
        self.allEmployees = employees.Select(function (x) {
            var benefits = Enumerable.From(x.ihr_ihr_employee_ihr_benefit.results).Select("$.ihr_name").ToArray();

            var trials = Enumerable.From(x.ihr_ihr_employee_ihr_employeetrail.results);
            var startTrail = trials.FirstOrDefault(null, '$.ihr_name == "Start" && $.statecode.Value == ' + trailActiveOption);
            var startDate = startTrail != null && startTrail.ihr_Date != null ? moment({ y: startTrail.ihr_Date.getFullYear(), M: startTrail.ihr_Date.getMonth(), d: startTrail.ihr_Date.getDate() }) : null;
            var endTrail = trials.FirstOrDefault(null, '$.ihr_name == "End" && $.statecode.Value == ' + trailActiveOption);
            var endDate = endTrail != null && endTrail.ihr_Date != null ? moment({ y: endTrail.ihr_Date.getFullYear(), M: endTrail.ihr_Date.getMonth(), d: endTrail.ihr_Date.getDate() }) : null;

            var employeeEvents = events.Where(function(e) {
                return e.ihr_Date != null && Enumerable.From(e.ihr_ihr_employee_ihr_event.results).Any("$.ihr_employeeId === '" + x.ihr_employeeId + "'");
            }).Select(function (e) {
                return new Event(e.ihr_eventId, moment({ y: e.ihr_Date.getFullYear(), M: e.ihr_Date.getMonth(), d: e.ihr_Date.getDate() }), e.ihr_Type.Value, e.ihr_IsSocialEvent, e.ihr_IsTouchpoint);
            }).ToArray();

            return new Employee(x.ihr_employeeId, x.ihr_fullname, x.ihr_ManagerId.Id, x.ihr_Group.Value, x.ihr_Office.Value, x.ihr_Pulse.Value, x.statecode.Value === activeOption, x.ihr_EmployeeStatus.Value == idcOption, benefits, startDate, endDate, endTrail != null ? (endTrail.ihr_Reason === "Voluntary") : false, employeeEvents);
        }).ToArray();
        
        self.allActiveEmployees = Enumerable.From(self.allEmployees).Where("$.isActive").ToArray();
    }

    function initializeTasks(tasks, taskMetadata) {
        self.allTasks = tasks
            .Where("$.RegardingObjectId.LogicalName == 'ihr_employee'")
            .Select(function (x) {
            return new Task(x.ActivityId, x.Subject, x.RegardingObjectId.Id);
        }).ToArray();

        self.allActiveEmployees = Enumerable.From(self.allEmployees).Where("$.isActive").ToArray();
    }

    // knockout bindings
    self.managerFilter = ko.observable(new Filter("Manager", function(employee) { return employee.managerId; }));
    self.filterByManager = function (manager) {
        self.managerFilter().setOption(manager.name());
    };

    self.groupFilter = ko.observable(new Filter("Group", function (employee) { return employee.groupId; }));
    self.filterByGroup = function (group) {
        self.groupFilter().setOption(group.name());
    };

    self.officeFilter = ko.observable(new Filter("Office", function (employee) { return employee.officeId; }));
    self.filterByOffice = function (office) {
        self.officeFilter().setOption(office.name());
    };

    self.filters = [self.managerFilter, self.groupFilter, self.officeFilter];

    self.clearFilters = function () {
        $.each(self.filters, function (i, f) { f().reset(); });
    };

    self.computedFilters = ko.computed(function() {
        return self.managerFilter().selectedIdStr() + "|" + self.groupFilter().selectedIdStr() + "|" + self.officeFilter().selectedIdStr();
    }).extend({ throttle: 100 });

    self.computedFilters.subscribe(function () {
        var filterEnumerable = Enumerable.From(self.filters);

        // filter active employees
        var filteredActiveEmployees = Enumerable.From(self.allActiveEmployees).Where(function(e) {
            return filterEnumerable.All(function(f) {
                return f().filterFunction(e);
            });
        }).ToArray();
        self.filteredActiveEmployees(filteredActiveEmployees);
        
        // filter all employees
        var filteredAllEmployees = Enumerable.From(self.allEmployees).Where(function (e) {
            return filterEnumerable.All(function (f) {
                return f().filterFunction(e);
            });
        }).ToArray();
        self.filteredAllEmployees(filteredAllEmployees);
    });
    
    self.filteredActiveEmployeesThrottled = ko.computed(self.filteredActiveEmployees).extend({ throttle: 100 });
    self.filteredActiveEmployeesThrottled.subscribe(function () {
        UpdatePulseChart();
        UpdateBenefitsChart();
        UpdateEventsChart("socialevents", "Social Events", "$.isSocial");
        UpdateEventsChart("touchpoints", "Touch Points", "$.isTouchpoint");
        UpateFollowUps();
    });

    self.filteredAllEmployeesThrottled = ko.computed(self.filteredAllEmployees).extend({ throttle: 100 });
    self.filteredAllEmployeesThrottled.subscribe(function() {
        self.turnovers().updateAll(Enumerable.From(self.filteredAllEmployees()).Where("$.isIdc").ToArray());
    });

    self.turnovers = ko.observable(new Turnovers());
    self.followUps = ko.observableArray([]);
    
    // knockout models
    function Filter(name, propertySelector) {
        var self = this;
        var NotAvailable = "__NA__";
        self.filterName = name;
        self.name = ko.observable(name);
        self.options = ko.observableArray([]);
        self.selectedId = ko.observable(NotAvailable);
        self.selectedIdStr = ko.observable();
        self.filterFunction = function(employee) {
            return self.selectedId() === NotAvailable || self.selectedId() === propertySelector(employee);
        };

        self.setOption = function(name) {
            var option = $.grep(self.options(), function (value, index) { return value.name() === name; })[0];
            if (option) {
                self.reset();
                self.name(name);
                option.isActive(true);
                $('.filter-select').removeClass('active');
                self.selectedId(option.id());
                self.selectedIdStr("" + option.id());
            }
        };
        
        self.canReset = ko.computed(function () {
            return self.selectedId() !== NotAvailable;
        });
        
        self.reset = function () {
            self.name(self.filterName);
            self.selectedId(NotAvailable);
            self.selectedIdStr("");
            $.each(self.options(), function (i, e) {
                e.isActive(false);
            });
        };
    }
    
    function FilterOption(name, id) {
        var self = this;
        self.name = ko.observable(name);
        self.id = ko.observable(id);
        self.isActive = ko.observable(false);
    }
    
    function Employee(id, name, managerId, groupId, officeId, pulseId, isActive, isIdc, benefits, startDate, endDate, endVoluntary, events) {
        var self = this;
        self.id = id;
        self.name = name;
        self.managerId = managerId;
        self.groupId = groupId;
        self.pulseId = pulseId;
        self.officeId = officeId;
        self.isActive = isActive;
        self.isIdc = isIdc;
        self.benefits = benefits;
        self.startDate = startDate;
        self.endDate = endDate;
        self.endVoluntary = endVoluntary;
        self.events = events ? events : [];
    }
    
    function Event(id, date, typeId, isSocial, isTouchpoint) {
        var self = this;
        self.id = id;
        self.date = date;
        self.dateDesc = date.format("MMMYY");
        self.typeId = typeId;
        self.isSocial = isSocial;
        self.isTouchpoint = isTouchpoint;
    }
    
    function Task(id, subject, employeeId) {
        var self = this;
        self.id = id;
        self.subject = subject;
        self.employeeId = employeeId;
    }
    
    function Turnover(name, from, to) {
        var self = this;
        self.name = ko.observable(name);
        self.value = ko.observable("?");
        self.from = from;
        self.to = to;
        self.lastEmployees = [];

        self.update = function (employees) {
            if (!employees)
                employees = self.lastEmployees;

            self.lastEmployees = employees;
            
            if (!employees || !self.from || !self.to || !self.from.isValid() || !self.to.isValid())
                return;

            var countFrom = Enumerable.From(employees).Count(function (x) {
                return x.startDate !== null && (x.startDate.isBefore(self.from) || x.startDate.isSame(self.from, 'day')) && (x.endDate === null || x.endDate.isAfter(self.from));
            });

            var countTo = Enumerable.From(employees).Count(function (x) {
                return x.startDate !== null && (x.startDate.isBefore(self.to) || x.startDate.isSame(self.to, 'day')) && (x.endDate === null || x.endDate.isAfter(self.to));
            });

            var countVoluntary = Enumerable.From(employees).Count(function (x) {
                return x.endVoluntary && x.endDate != null && (x.endDate.isAfter(self.from) || x.endDate.isSame(self.from)) && (x.endDate.isBefore(self.to) || x.endDate.isSame(self.to));
            });

            var turnover = countFrom + countTo > 0 ? Math.round(200 * countVoluntary / (countFrom + countTo)) : "?";
            self.value(turnover);
        };

        self.updateCustom = function(from, to) {
            self.from = from;
            self.to = to;
            self.name("" + from.format("DD/MM/YY") + " - " + to.format("DD/MM/YY"));
            self.update();
        };
    }
    
    function Turnovers() {
        var self = this;

        var now = moment();
        var ytdStart = moment({ y: now.year(), M: fiscalYearStartMonth - 1, d: 1 });
        if (ytdStart.isAfter(now))
            ytdStart = ytdStart.subtract(1, 'years');
        
        // current fiscal year
        self.YTD = new Turnover("YTD", ytdStart, now.clone());
        
        // custom dates - init to last month
        self.custom = new Turnover("", null, null);
        self.custom.updateCustom(now.clone().subtract(1, "months"), now.clone());
        
        // quarters
        var currentQuarter = now.clone().subtract(fiscalYearStartMonth - 1, "months").quarter();
        self.quarters = ko.observable(Enumerable.Range(0, 4).Select(function (x) {
            var quarterStart = moment([now.year(), (currentQuarter - 1) * 3, 1]).subtract((13 - fiscalYearStartMonth) % 12, "months").subtract(x * 3, "months");
            var quarterEnd = quarterStart.clone().add(2, "months").endOf("month");
            var quarterFiscalYear = moment([now.year(), (currentQuarter - 1) * 3, 1]).subtract(x * 3, "months").format("YY");
            var quarterNo = quarterStart.clone().subtract(fiscalYearStartMonth - 1, "months").quarter()

            if (quarterEnd.isAfter(now))
                quarterEnd = now.clone();

            return new Turnover("FY" + quarterFiscalYear + " Q" + quarterNo, quarterStart, quarterEnd);
        }).ToArray());
        
        self.allTurnovers = [self.YTD, self.custom].concat(self.quarters());
        

        // logic for custom dates
        self.customFrom = ko.observable(self.custom.from.format("DD/MM/YY"));
        self.customTo = ko.observable(self.custom.to.format("DD/MM/YY"));

        self.customUpdate = function () {
            var from = moment(self.customFrom(), "DD/MM/YY");
            var to = moment(self.customTo(), "DD/MM/YY");

            if (from.isValid() && to.isValid() && (from.isBefore(to) || from.isSame(to))) {
                self.custom.updateCustom(from, to);
            }
        };

        // update turnovers
        self.updateAll = function(employees) {
            $.each(self.allTurnovers, function (i, t) {
                t.update(employees);
            });
        };
    }
    
    function FollowUp(id, entityObjectTypeCode, name, title, isRed, isOrange, isTask) {
        var self = this;
        self.id = id;
        self.name = name;
        self.entityObjectTypeCode = entityObjectTypeCode;
        self.title = title;
        self.isRed = isRed;
        self.isOrange = isOrange;
        self.isTask = isTask;
    }

    // update functions
    function UpdatePulseChart() {
        var currEmployees = Enumerable.From(self.filteredActiveEmployees()).Where("$.isIdc").ToArray();
        var all = currEmployees.length;
        var pulseData = all > 0 ? Enumerable.From(currEmployees)
            .GroupBy("$.pulseId")
            .Select(function (g) {
                var pulseOption = self.pulseOptionsEnumerable.Single(function (x) { return g.Key() === x.value; });
                return { collectionAlias: pulseOption.name, y: parseFloat((g.source.length * 100.0 / all).toFixed(1)), pointName: "" + g.source.length, color: pulseOption.color };
            })
            .ToArray() : [];

        $("#pulse").shieldChart({
            exportOptions: {
                image: false,
                print: false
            },
            primaryHeader: {
                text: "Pulse"
            },
            seriesSettings: {
                donut: {
                    enablePointSelection: true
                }
            },
            tooltipSettings: {
                customPointText: "{point.collectionAlias}: {point.pointName} | {point.y}" + "%"
            },
            seriesPalette: Enumerable.From(pulseData).Select("$.color").ToArray(),
            dataSeries: [{
                seriesType: "donut",
                collectionAlias: "Pulse",
                data: pulseData
            }]
        });
    }

    function UpdateBenefitsChart() {
        var currEmployees = Enumerable.From(self.filteredActiveEmployees()).Where("$.isIdc").ToArray();
        var all = currEmployees.length;
        
        self.benefitOptionsEnumerable.ForEach(function (b) {
            var count = Enumerable.From(currEmployees).Count(function(e) {
                return $.inArray(b.benefitName, e.benefits) !== -1;
            });
            
            var chartData = all > 0 ? [
                { collectionAlias: "Not assigned", y: parseFloat(((all - count) * 100.0 / all).toFixed(1)), pointName: "" + (all - count), color: "#e3e3e3" },
                { collectionAlias: b.benefitName, y: parseFloat((count * 100.0 / all).toFixed(1)), pointName: "" + count, color: b.color }] : [];
            
            $("#" + b.divId).shieldChart({
                exportOptions: {
                    image: false,
                    print: false
                },
                primaryHeader: {
                    text: "Benefits"
                },
                seriesSettings: {
                    donut: {
                        enablePointSelection: true
                    }
                },
                tooltipSettings: {
                    customPointText: "{point.collectionAlias}: {point.pointName} | {point.y}" + "%"
                },
                seriesPalette: [
                    "#e3e3e3",
                    b.color
                ],
                dataSeries: [{
                    seriesType: "donut",
                    collectionAlias: b.benefitName,
                    data: chartData
                }]
            });
        });
        
        setTimeout(function () {
            $('.benefits svg g g:nth-child(2)').attr('transform', 'translate(66, 55)');
            $('.benefits svg g g:nth-child(2)').animate({ opacity: 1 }, 300);
        }, 50);
    }
    
    function UpdateEventsChart(chartDiv, chartName, whereQuery) {
        var currEmployees = self.filteredActiveEmployees();

        var events = Enumerable.From(currEmployees).SelectMany("$.events").Distinct("$.id").Where(whereQuery).ToArray();

        var types = Enumerable.From(events).Select("$.typeId").Distinct().Select(function (t) {
            return self.eventTypesEnumerable.First("$.value == " + t);
        }).ToArray();

        var eventsEnumerable = Enumerable.From(events);
        var monthsEnumerable = Enumerable.From(self.eventMonths);
        var dataSeries = Enumerable.From(types).Select(function (t) {
            var data = monthsEnumerable.Select(function (m) {
                var mEnd = m.clone().endOf("month").endOf("day");
                return eventsEnumerable.Where("$.typeId == " + t.value).Count(function (e) {
                    return (e.date.isSame(m) || e.date.isAfter(m)) && (e.date.isSame(mEnd) || e.date.isBefore(mEnd))
                });
            }).ToArray();

            return { seriesType: "bar", collectionAlias: t.name, data: data };
        }).ToArray();

        $("#" + chartDiv).shieldChart({
            exportOptions: {
                image: false,
                print: false
            },
            seriesSettings: {
                bar: {
                    stackMode: "normal"
                }
            },
            axisX: {
                drawColor: "transparent",
                ticksColor: "transparent",
                categoricalValues: monthsEnumerable.Select(function (m) { return m.format("MMMYY"); }).ToArray()
            },
            primaryHeader: {
                text: chartName
            },
            chartLegend: {
                enabled: false
            },
            seriesPalette: Enumerable.From(types).Select("$.color").ToArray(),
            dataSeries: dataSeries
        });
    }
    
    function UpateFollowUps() {
        var currEmployeesEnumerable = Enumerable.From(self.filteredActiveEmployees());
        
        var reds = currEmployeesEnumerable.Where("$.pulseId == '" + self.pulseOptionsEnumerable.First("$.name == 'Red'").value + "'").Select(function (e) { return new FollowUp(e.id, self.employeeObjectTypeCode(), e.name, "Red Pulse", true, false, false); }).OrderBy("$.name");
        var oranges = currEmployeesEnumerable.Where("$.pulseId == '" + self.pulseOptionsEnumerable.First("$.name == 'Orange'").value + "'").Select(function (e) { return new FollowUp(e.id, self.employeeObjectTypeCode(), e.name, "Orange Pulse", false, true, false); }).OrderBy("$.name");
        
        var tasksEnumerable = Enumerable.From(self.allTasks);
        var tasks = tasksEnumerable.Join(currEmployeesEnumerable, "$.employeeId", "$.id", function (t, e) {
            return new FollowUp(t.id, self.taskObjectTypeCode(), e.name, t.subject, false, false, true);
        });

        var followUps = reds.Concat(oranges).Concat(tasks).ToArray();

        self.followUps(followUps);
    }
    
}).call(HrDashboard);