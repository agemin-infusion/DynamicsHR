function calculateCurrentRetentionRate(callback){
	var employeeData = new Array();
	SDK.JQuery.retrieveMultipleRecords(
     "ihr_employee",
     "ihr_EndDate", 
     function (employees) {
		employeeData.concat(employees);
     },
     function(err){
		alert(err);
	 },
	 function(completed){
		
	 }
   );
   
   SDK.JQuery._context
	
	return "10%";
}