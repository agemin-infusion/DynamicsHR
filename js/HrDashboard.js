HrDashboard = window.HrDashboard || {};

(function() {
    var self = this;

    self.allEmployeesEnumerable = null;
    self.allMetadata = null;
    
    self.pulseOptionsEnumerable = null;
    self.benefitOptionsEnumerable = null;
    self.allEmployees = [];
    self.allActiveEmployees = [];
    self.filteredEmployees = ko.observable([]);

    // async methods
    self.refresh = function(loadData) {
        async.auto({
                employees: function (callback) { getEmployeeData(callback, loadData); },
                employeeMetadata: function (callback) { getEmployeeEntityMetaData(callback, loadData); },
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

                turnover: ['employees', function(next, results) {
                    calculateRetentionRate(results.employees, new Date('2013.11.01'), new Date(), function(retentionrate) {
                        $("#retentionRate").html(retentionrate * 100 + "%");
                        next();
                    });
                }],
                initializeEmployees: ['employees', 'employeeMetadata', 'managerFilter', 'officeAndGroupFilter', 'initializePulseOptions', 'benefitOptions', function (next, results) {
                    initializeEmployees(results.employees, results.employeeMetadata);
                    next();
                }],
                redPeople: ['employees', 'employeeMetadata', function(next, results) {
                    fillRedPeople(results.employees, results.employeeMetadata);
                    next();
                }]
            },
            function(err, results) {
                if (err) {
                    alert(err);
                }
            });

    };

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
    
    function getEmployeeEntityMetaData(callback, refresh) {
        if (self.allMetadata && !refresh) {
            callback(null, self.allMetadata);
            return;
        }

        SDK.Metadata.RetrieveEntity(SDK.Metadata.EntityFilters.Attributes, "ihr_employee", null, false, function (data) {
            self.allMetadata = data;
            callback(null, data);
        },
        function (err) {
            callback(err, null);
        });
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
        var optionsManager = employees
            .GroupBy(function (x) { return x.ihr_ManagerId; }, function (x) { return { id: x.ihr_ManagerId.Id }; }, function (x, y) { return new FilterOption(x.Name ? x.Name : "No manager", x.Id); }, function (x) { return x.Id; })
            .Where("$.id() !== null")
            .ToArray();
        self.managerFilter().options(optionsManager);
    }
    
    function initializeOfficeAndGroupFilters(entityMetadata) {
        //Office
        var attOffice = Enumerable
            .From(entityMetadata.Attributes)
            .Where(function (x) { return x.SchemaName == "ihr_Office"; })
            .Single();

        var optionsOffice = Enumerable.From(attOffice.OptionSet.Options)
            .Select(function (x) { return new FilterOption(x.Label.UserLocalizedLabel.Label, x.Value); })
            .ToArray();

        self.officeFilter().options(optionsOffice);

        //Group
        var attGroup = Enumerable
          .From(entityMetadata.Attributes)
          .Where(function (x) { return x.SchemaName == "ihr_Group"; })
          .Single();

        var optionsGroup = Enumerable.From(attGroup.OptionSet.Options)
           .Select(function (x) { return new FilterOption(x.Label.UserLocalizedLabel.Label, x.Value); })
           .ToArray();

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
    
    function initializeEmployees(employees, entityMetadata) {
        var attStateCode = Enumerable
         .From(entityMetadata.Attributes)
         .Where(function (x) { return x.SchemaName == "statecode"; })
         .Single();

        var activeOption = Enumerable.From(attStateCode.OptionSet.Options)
           .Single(function (x) { return x.Label.UserLocalizedLabel.Label == "Active"; }).Value;
        
        self.allEmployees = employees.Select(function (x) {
            var benefits = Enumerable.From(x.ihr_ihr_employee_ihr_benefit.results).Select("$.ihr_name").ToArray();
            return new Employee(x.ihr_employeeId, x.ihr_fullname, x.ihr_ManagerId.Id, x.ihr_Group.Value, x.ihr_Office.Value, x.ihr_Pulse.Value, x.statecode.Value === activeOption, benefits);
        }).ToArray();
        
        self.allActiveEmployees = Enumerable.From(self.allEmployees).Where("$.isActive").ToArray();

        self.clearFilters();
    }

    function calculateRetentionRate(employeesEnumerable, periodStartDate, periodEndDate, callback) {
        return;
        // (EmployeeStartDate is null || EmployeeStartDate < PeriodStartDate) && (EmployeeEndDate is not NULL && EmployeeEndDate between PeriodStartDate and PeriodEndDate) && Reason == Volountary
        var numberOfEmployeesWhoLeft = employeesEnumerable
            .Count(function (x) { return (x.ihr_StartDate == null || x.ihr_StartDate < periodStartDate) && (x.ihr_EndDate != null && x.ihr_EndDate >= periodStartDate && x.ihr_EndDate < periodEndDate) });

        // (EmployeeStartDate == null || EmployeeStartDate before PeriodStartDate ) && (EmployeeEndDate is null || EmployeeEndDate before PeriodStartDate)
        var startNumber = countActiveEmployeesForDate(employeesEnumerable, periodStartDate);

        // ( End date is null || EndDate is > PeriodEndDate)
        var endNumber = employeesEnumerable
            .Count(function (x) { return (x.ihr_StartDate == null || x.ihr_StartDate < periodStartDate) && (x.ihr_EndDate == null || x.ihr_EndDate < periodStartDate) });

        var retentionRateValue = numberOfEmployeesWhoLeft / ((startNumber + endNumber) / 2);

        callback(retentionRateValue);
    }

    function countActiveEmployeesForDate(employees, date) {
        return;
        employees.Count(function (x) {
            if (Object.prototype.toString.call(x.ihr_ihr_employee_ihr_employeetrail.results) === '[object Array]') {
                if (x.ihr_ihr_employee_ihr_employeetrail.results.length == 2) {
                    var trails = Enumerable.From(x.ihr_ihr_employee_ihr_employeetrail.results)
                    .Where(function (tr) { return tr.statecode.Value == 1 && tr.ihr_date <= date; })
                    .Max(function (tr) { return tr.ihr_date; })
                    
                }
            } 
        });
    }

    function fillRedPeople(employees, entityMetadata) {
        return;
        var attPulse = Enumerable
         .From(entityMetadata.Attributes)
         .Where(function (x) { return x.SchemaName == "ihr_Pulse" })
         .Single();

        var redOption = Enumerable.From(attPulse.OptionSet.Options)
           .Single(function (x) { return x.Label.UserLocalizedLabel.Label == "Red"; }).Value;
        //TODO: Add orange

        var redPeopleList = $("#redPeople");
        redPeopleList.empty();
        employees
        .Where(function (x) { return x.ihr_Pulse.Value == redOption })
        .ForEach(function (x) {
            redPeopleList.append("<li>" + x.ihr_fullname + "</li>");

        });
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

        // filter employees
        var filteredEmployees = Enumerable.From(self.allActiveEmployees).Where(function(e) {
            return filterEnumerable.All(function(f) {
                return f().filterFunction(e);
            });
        }).ToArray();
        
        self.filteredEmployees(filteredEmployees);
    });
    
    self.filteredEmployeesThrottled = ko.computed(self.filteredEmployees).extend({ throttle: 100 });
    self.filteredEmployeesThrottled.subscribe(function () {
        UpdatePulseChart();
        UpdateBenefitsChart();
    });

    // knockout models
    function Filter(name, propertySelector) {
        var self = this;
        self.filterName = name;
        self.name = ko.observable(name);
        self.options = ko.observableArray([]);
        self.selectedId = ko.observable(null);
        self.selectedIdStr = ko.observable();
        self.filterFunction = function(employee) {
            return self.selectedId() === null || self.selectedId() === propertySelector(employee);
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
        
        self.reset = function () {
            self.name(self.filterName);
            self.selectedId(null);
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
    
    function Employee(id, name, managerId, groupId, officeId, pulseId, isActive, benefits) {
        var self = this;
        self.id = id;
        self.name = name;
        self.managerId = managerId;
        self.groupId = groupId;
        self.pulseId = pulseId;
        self.officeId = officeId;
        self.isActive = isActive;
        self.benefits = benefits;
    }


    function UpdatePulseChart() {
        var currEmployees = self.filteredEmployees();
        var all = currEmployees.length;
        var pulseData = Enumerable.From(currEmployees)
            .GroupBy("$.pulseId")
            .Select(function (g) {
                var pulseOption = self.pulseOptionsEnumerable.Single(function (x) { return g.Key() === x.value; });
                return { collectionAlias: pulseOption.name, y: parseFloat((g.source.length * 100.0 / all).toFixed(1)), pointName: "" + g.source.length, color: pulseOption.color };
            })
            .ToArray();

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
        var currEmployees = self.filteredEmployees();
        var all = currEmployees.length;
        
        self.benefitOptionsEnumerable.ForEach(function (b) {
            var count = Enumerable.From(currEmployees).Count(function(e) {
                return $.inArray(b.benefitName, e.benefits) !== -1;
            });
            
            var chartData = [
                { collectionAlias: "Not assigned", y: parseFloat(((all - count) * 100.0 / all).toFixed(1)), pointName: "" + (all - count), color: "#e3e3e3" },
                { collectionAlias: b.benefitName, y: parseFloat((count * 100.0 / all).toFixed(1)), pointName: "" + count, color: b.color }];
            
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
    }
    
}).call(HrDashboard);