HrDashboard = window.HrDashboard || {};

(function () {
    this.refresh = function(loadData) {
        async.auto({
            employees: getEmployeeData,
            employeeMetadata: getEmployeeEntityMetaData,

            managerFilter: ['employees', function (next, results) {
                initializeManagerFilter(results.employees);
                next();
            }],

            officeAndGroupFilter: ['employeeMetadata', function (next, results) {
                initializeOfficeAndGroupFilters(results.employeeMetadata);
                next();
            }],

            turnover: ['employees', function (next, results) {
                calculateRetentionRate(results.employees, new Date('2013.11.01'), new Date(), function (retentionrate) {
                    $("#retentionRate").html(retentionrate * 100 + "%");
                    next();
                });
            }],
            redPeople: ['employees', 'employeeMetadata', function (next, results) {
                fillRedPeople(results.employees, results.employeeMetadata);
                next();
            }]
        },
        function (err, results) {
            if (err) {
                alert(err);
            }
        });

    }



    function getEmployeeData(callback, refresh) {
        var employeeData = new Array();
        SDK.JQuery.retrieveMultipleRecords(
         "ihr_employee",
         "ihr_StartDate,ihr_EndDate,ihr_Office,ihr_Pulse,ihr_ManagerId,ihr_EmployeeStatus,statecode,statuscode, ihr_Group",
         function (employees) {
             employeeData = employeeData.concat(employees);
         },
         function (err) {
             callback(err, null);
         },
         function (completed) {
             var employeesEnumerable = Enumerable.From(employeeData);
             callback(null, employeesEnumerable);
         }
       );
    }

    function calculateRetentionRate(employeesEnumerable, periodStartDate, periodEndDate, callback) {
        // (EmployeeStartDate is null || EmployeeStartDate < PeriodStartDate) && (EmployeeEndDate is not NULL && EmployeeEndDate between PeriodStartDate and PeriodEndDate) && Reason == Volountary
        var numberOfEmployeesWhoLeft = employeesEnumerable
            .Count(function (x) { return (x.ihr_StartDate == null || x.ihr_StartDate < periodStartDate) && (x.ihr_EndDate != null && x.ihr_EndDate >= periodStartDate && x.ihr_EndDate < periodEndDate) });

        // (EmployeeStartDate == null || EmployeeStartDate before PeriodStartDate ) && (EmployeeEndDate is null || EmployeeEndDate before PeriodStartDate)
        var startNumber = employeesEnumerable
            .Count(function (x) { return (x.ihr_StartDate == null || x.ihr_StartDate < periodStartDate) && (x.ihr_EndDate == null || x.ihr_EndDate < periodStartDate) });

        // ( End date is null || EndDate is > PeriodEndDate)
        var endNumber = employeesEnumerable
            .Count(function (x) { return (x.ihr_StartDate == null || x.ihr_StartDate < periodStartDate) && (x.ihr_EndDate == null || x.ihr_EndDate < periodStartDate) });

        var retentionRateValue = numberOfEmployeesWhoLeft / ((startNumber + endNumber) / 2);

        callback(retentionRateValue);
    }

    function initializeManagerFilter(employees) {
        var managersSelect = $("#managers");
        managersSelect.empty();
        employees
            .GroupBy(function (x) { return x.ihr_ManagerId }, function (x) { return { id: x.ihr_ManagerId.Id }; }, function (x, y) { return { Id: x.Id, Name: x.Name }; }, function (x) { return x.Id; })
            .ForEach(function (x) {
                managersSelect.append("<option value='" + x.Id + "'>" + x.Name + "</option>");
            });
    }

    function getEmployeeEntityMetaData(callback) {
        SDK.Metadata.RetrieveEntity(SDK.Metadata.EntityFilters.Attributes, "ihr_employee", null, false, function (data) {
            callback(null, data);
        },
        function (err) {
            callback(err, null);
        });
    }



    function initializeOfficeAndGroupFilters(entityMetadata) {
        //Office
        var attOffice = Enumerable
            .From(entityMetadata.Attributes)
            .Where(function (x) { return x.SchemaName == "ihr_Office" })
            .Single();

        var officeSelect = $("#offices");
        officeSelect.empty();
        var optionsOffice = Enumerable.From(attOffice.OptionSet.Options)
            .Select(function (x) { return { Id: x.Value, Name: x.Label.UserLocalizedLabel.Label }; })
            .ForEach(function (x) {
                officeSelect.append("<option value='" + x.Id + "'>" + x.Name + "</option>");

            });

        //Group

        var groupsSelect = $("#groups");
        groupsSelect.empty();

        var attGroup = Enumerable
          .From(entityMetadata.Attributes)
          .Where(function (x) { return x.SchemaName == "ihr_Group" })
          .Single();

        var optionsGroup = Enumerable.From(attGroup.OptionSet.Options)
           .Select(function (x) { return { Id: x.Value, Name: x.Label.UserLocalizedLabel.Label }; })
           .ForEach(function (x) {
               groupsSelect.append("<option value='" + x.Id + "'>" + x.Name + "</option>");

           });


    }

    function fillRedPeople(employees, entityMetadata) {
        var attPulse = Enumerable
         .From(entityMetadata.Attributes)
         .Where(function (x) { return x.SchemaName == "ihr_Pulse" })
         .Single();

        var redOption = Enumerable.From(attPulse.OptionSet.Options)
           .Single(function (x) { return x.Label.UserLocalizedLabel.Label == "Red"; }).Value;
        
        var redPeopleList = $("#redPeople");
        redPeopleList.empty();
        employees
        .Where(function (x) { return x.ihr_Pulse.Value == redOption })
        .ForEach(function (x) {
            redPeopleList.append("<li>" + x.ihr_fullname + "</li>");

        });
    }

}).call(HrDashboard);