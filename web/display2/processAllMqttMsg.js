/**
 * Functions to update graph and gui values via MQTT-messages
 *
 * @author Kevin Wieland
 * @author Michael Ortenstein
 */

function updateDashboardElement(elementText, elementChart, text, value){
	// update text
	if(elementText != null){
		elementText.text(text);
	}
	// get last values
	if(elementChart != null){
		var chartdata = elementChart.attr('values');
		var chartdataarray = chartdata.split(',');
		// add new value
		chartdataarray.push( value );
		// limit data length to 100 values
		chartdataarray = chartdataarray.slice(-57);
		// store values
		elementChart.attr('values', chartdataarray.join(','));
		// update chart
		elementChart.sparkline( chartdataarray, {
			// global settings
			//	width: '100%', // problem with hidden sparklines!
			width: '280px',
			height: '40px',
			disableInteraction: true,
			// test with line type
			// highlightSpotColor: 'green',
			// fillColor: 'green',
			// lineColor: 'green',
			// spotColor: 'white',
			// spotRadius: '5',
			// minSpotColor: '',
			// maxSpotColor: ''
			// test with bar type
			type: 'bar',
			enableTagOptions: true
		});
	}
}

function getCol(matrix, col){
	var column = [];
	for(var i=0; i<matrix.length; i++){
		column.push(matrix[i][col]);
	}
	return column;
}

function convertToKw(dataColum) {
	var convertedDataColumn = [];
	dataColum.forEach((value) => {
		convertedDataColumn.push(value / 1000);
	});
	return convertedDataColumn;
}

function getIndex(topic) {
	// get occurence of numbers between / / in topic
	// since this is supposed to be the index like in openwb/lp/4/w
	// no lookbehind supported by safari, so workaround with replace needed
	var index = topic.match(/(?:\/)([0-9]+)(?=\/)/g)[0].replace(/[^0-9]+/g, '');
	if ( typeof index === 'undefined' ) {
		index = '';
	}
	return index;
}

function handlevar(mqttmsg, mqttpayload) {
	//console.log("Topic: "+mqttmsg+" Message: "+mqttpayload);
	// receives all messages and calls respective function to process them
	if ( mqttmsg.match( /^openwb\/evu\//i) ) { processEvuMessages(mqttmsg, mqttpayload); }
	else if ( mqttmsg.match( /^openwb\/global\//i) ) { processGlobalMessages(mqttmsg, mqttpayload); }
	else if ( mqttmsg.match( /^openwb\/housebattery\//i) ) { processHousebatteryMessages(mqttmsg, mqttpayload); }
	else if ( mqttmsg.match( /^openwb\/system\//i) ) { processSystemMessages(mqttmsg, mqttpayload); }
	else if ( mqttmsg.match( /^openwb\/pv\//i) ) { processPvMessages(mqttmsg, mqttpayload); }
	else if ( mqttmsg.match( /^openwb\/lp\//i) ) { processLpMessages(mqttmsg, mqttpayload); }
	else if ( mqttmsg.match( /^openwb\/config\/get\/sofort\/lp\//i) ) { processSofortConfigMessages(mqttmsg, mqttpayload); }
	else if ( mqttmsg.match( /^openwb\/config\/get\/pv\//i) ) { processPvConfigMessages(mqttmsg, mqttpayload); }
}  // end handlevar

function processPvConfigMessages(mqttmsg, mqttpayload) {
	if ( mqttmsg == 'openWB/config/get/pv/priorityModeEVBattery' ) {
		// sets button color in charge mode modal and sets icon in mode select button
		switch (mqttpayload) {
			case '0':
				// battery priority
				$('#evPriorityBtn').removeClass('btn-success');
				$('#batteryPriorityBtn').addClass('btn-success');
				$('.priorityEvBatteryIcon').removeClass('fa-car').addClass('fa-car-battery')
				break;
			case '1':
				// ev priority
				$('#evPriorityBtn').addClass('btn-success');
				$('#batteryPriorityBtn').removeClass('btn-success');
				$('.priorityEvBatteryIcon').removeClass('fa-car-battery').addClass('fa-car')
			break;
		}
	}
	else if ( mqttmsg == 'openWB/config/get/pv/nurpv70dynact' ) {
		//  and sets icon in mode select button
		switch (mqttpayload) {
			case '0':
				// deaktiviert
				$('#70ModeBtn').hide();
				break;
			case '1':
				// activiert
				$('#70ModeBtn').show();
			break;
		}
	}
	else if ( mqttmsg == 'openWB/config/get/pv/minCurrentMinPv' ) {
		setInputValue('minCurrentMinPv', mqttpayload);
	}
}

function processSofortConfigMessages(mqttmsg, mqttpayload) {
	// processes mqttmsg for topic openWB/config/get/sofort/
	// called by handlevar
	var elementId = mqttmsg.replace('openWB/config/get/sofort/', '');
	var element = $('#' + $.escapeSelector(elementId));
	if ( element.attr('type') == 'range' ) {
		setInputValue(elementId, mqttpayload);
	} else if ( element.hasClass('btn-group-toggle') ) {
		setToggleBtnGroup(elementId, mqttpayload);
	}

}

function processEvuMessages(mqttmsg, mqttpayload) {
	// processes mqttmsg for topic openWB/evu
	// called by handlevar
	if ( mqttmsg == 'openWB/evu/W' ) {
		var prefix = '';
		var unit = ' W';
		var powerEvu = parseInt(mqttpayload, 10);
		if ( isNaN(powerEvu) ) {
			powerEvu = 0;
		}
		// now use a temp value to keep original value with sign for sparkline
		var powerEvuValue = powerEvu;
		if ( powerEvuValue > 0 ) {
			prefix = ' Imp: ';
		} else if( powerEvuValue < 0 ) {
			powerEvuValue *= -1;
			prefix = ' Exp: ';
		}
		var powerEvuText = powerEvuValue.toString();
		if ( powerEvuValue >= 1000 ) {
			powerEvuText = (powerEvuValue / 1000).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
			unit = ' kW';
		}
		var element = $('#evul');
		var elementChart = $('#evulchart');
		updateDashboardElement(element, elementChart, prefix + powerEvuText + unit, powerEvu);
	 }
}

function processGlobalMessages(mqttmsg, mqttpayload) {
	// processes mqttmsg for topic openWB/global
	// called by handlevar
	if ( mqttmsg == 'openWB/global/WHouseConsumption' ) {
		var unit = ' W';
		var powerHouse = parseInt(mqttpayload, 10);
		if ( isNaN(powerHouse) || (powerHouse < 0) ) {
			powerHouse = 0;
		}
		powerHouseText = powerHouse.toString();
		if ( powerHouse > 999 ) {
			powerHouseText = (powerHouse / 1000).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
			unit = ' kW';
		}
		var element = $('#hausverbrauchl');
		var elementChart = $('#hausverbrauchlchart');
		updateDashboardElement(element, elementChart, powerHouseText + unit, powerHouse);
	}
	else if ( mqttmsg == 'openWB/global/WAllChargePoints') {
		var unit = ' W';
		var powerAllLp = parseInt(mqttpayload, 10);
		if ( isNaN(powerAllLp) ) {
			powerAllLp = 0;
		}
		powerAllLpText = powerAllLp.toString();
		if (powerAllLp > 999) {
			powerAllLpText = (powerAllLp / 1000).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
			unit = ' kW';
		}
		var element = $('#gesamtll');
		var elementChart = $('#gesamtllchart');
		updateDashboardElement(element, elementChart, powerAllLpText + unit, powerAllLp);
	}
	else if ( mqttmsg == 'openWB/global/strLastmanagementActive' ) {
		if ( mqttpayload.length >= 5 ) {
			// if there is info-text in payload for topic, show the text
			$('#lastregelungaktiv').text(mqttpayload);
			$('#lastmanagementShowBtn').show();
		} else {
			// if there is no text, show nothing (hides row)
			$('#lastregelungaktiv').text('');
			$('#lastmanagementShowBtn').hide();
		}
	}
	else if ( mqttmsg == 'openWB/global/ChargeMode' ) {
		// set modal button colors depending on charge mode
		// set visibility of divs
		// set visibility of priority icon depending on charge mode
		// (priority icon is encapsulated in another element hidden/shown by housebattery configured or not)
		switch (mqttpayload) {
			case '0':
				// mode sofort
				$('.chargeModeSelectBtnText').text('Sofort');  // text btn mainpage
				$('.chargeModeBtn').removeClass('btn-success');  // changes to select btns in modal
				$('#chargeModeSofortBtn').addClass('btn-success');
				$('.priorityEvBatteryIcon').hide();  // visibility of priority icon
				$('.ladepunktConfig').addClass('hide'); // modal chargepoint config
				$('.ladepunktConfigSofort').removeClass('hide'); // modal chargepoint config
				break;
			case '1':
				// mode min+pv
				$('.chargeModeSelectBtnText').text('Min+PV');
				$('.chargeModeBtn').removeClass('btn-success');
				$('#chargeModeMinPVBtn').addClass('btn-success');
				$('.priorityEvBatteryIcon').hide();
				$('.ladepunktConfig').addClass('hide'); // modal chargepoint config
				$('.ladepunktConfigMinPv').removeClass('hide'); // modal chargepoint config
				break;
			case '2':
				// mode pv
				$('.chargeModeSelectBtnText').text('PV');
				$('.chargeModeBtn').removeClass('btn-success');
				$('#chargeModePVBtn').addClass('btn-success');
				$('.priorityEvBatteryIcon').show();
				$('.ladepunktConfig').addClass('hide'); // modal chargepoint config
				$('.ladepunktConfigPv').removeClass('hide'); // modal chargepoint config
				break;
			case '3':
				// mode stop
				$('.chargeModeSelectBtnText').text('Stop');
				$('.chargeModeBtn').removeClass('btn-success');
				$('#chargeModeStopBtn').addClass('btn-success');
				$('.priorityEvBatteryIcon').hide();
				$('.ladepunktConfig').addClass('hide'); // modal chargepoint config
				$('.ladepunktConfigStop').removeClass('hide'); // modal chargepoint config
				break;
			case '4':
				// mode standby
				$('.chargeModeSelectBtnText').text('Standby');
				$('.chargeModeBtn').removeClass('btn-success');
				$('#chargeModeStdbyBtn').addClass('btn-success');
				$('.priorityEvBatteryIcon').hide();
				$('.ladepunktConfig').addClass('hide'); // modal chargepoint config
				$('.ladepunktConfigStandby').removeClass('hide'); // modal chargepoint config
		}
	}
}

function processHousebatteryMessages(mqttmsg, mqttpayload) {
	// processes mqttmsg for topic openWB/housebattery
	// called by handlevar
	if ( mqttmsg == 'openWB/housebattery/W' ) {
		var prefix = '';
		var unit = ' W';
		var speicherwatt = parseInt(mqttpayload, 10);
		if ( isNaN(speicherwatt) ) {
			speicherwatt = 0;
		}
		// now use a temp value to keep original value with sign for sparkline
		var speicherwattValue = speicherwatt;
		if ( speicherwattValue > 0 ) {
			prefix = 'Ladung: ';
		} else if ( speicherwattValue < 0 ) {
			speicherwattValue *= -1;
			prefix = 'Entladung: ';
		}
		var speicherwattText = speicherwattValue.toString();
		if ( speicherwattValue > 999 ) {
			speicherwattText = (speicherwatt / 1000).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
			unit = ' kW';
		}
		var element = $('#hausbatteriell');
		var elementChart = $('#hausbatteriellchart');
		updateDashboardElement(element, elementChart, prefix + speicherwattText + unit, speicherwatt);
	}
	else if ( mqttmsg == 'openWB/housebattery/%Soc' ) {
		var speicherSoc = parseInt(mqttpayload, 10);
		var unit = ' %';
		var speicherSocText = speicherSoc.toString();
		if ( isNaN(speicherSoc) || speicherSoc < 0 || speicherSoc > 100 ) {
			speicherSocText = '--';
		}
		// adjust value for sparkline
		if ( isNaN(speicherSoc) || speicherSoc < 0 ) {
			speicherSoc = 0;
		}
		if ( speicherSoc > 100 ) {
			speicherSoc = 100;
		}
		var element = $('#hausbatteriesoc');
		var elementChart = $('#hausbatteriesocchart');
		updateDashboardElement(element, elementChart, speicherSocText + unit, speicherSoc);
	}
	else if ( mqttmsg == 'openWB/housebattery/boolHouseBatteryConfigured' ) {
		if ( mqttpayload == 1 ) {
			// if housebattery is configured, show info-cards
			$('.hausbatterie').show();
			// and outer element for priority icon in pv mode
			$('#priorityEvBattery').show();
			// priority buttons in modal
			$('#priorityModeBtns').show();
			// update sparklines
			$.sparkline_display_visible();
		} else {
			$('.hausbatterie').hide();
			$('#priorityEvBattery').hide();
			$('#priorityModeBtns').hide();
		}
	}
}

function processSystemMessages(mqttmsg, mqttpayload) {
	// processes mqttmsg for topic openWB/system
	// called by handlevar
	if ( mqttmsg == 'openWB/system/Timestamp') {
		var dateObject = new Date(mqttpayload * 1000);  // Unix timestamp to date-object
		var time = '&nbsp;';
		var date = '&nbsp;';
		if ( dateObject instanceof Date && !isNaN(dateObject.valueOf()) ) {
			// timestamp is valid date so process
			var HH = String(dateObject.getHours()).padStart(2, '0');
			var MM = String(dateObject.getMinutes()).padStart(2, '0');
			time = HH + ':'  + MM;
			var dd = String(dateObject.getDate()).padStart(2, '0');  // format with leading zeros
			var mm = String(dateObject.getMonth() + 1).padStart(2, '0'); //January is 0 so add +1!
			var dayOfWeek = dateObject.toLocaleDateString('de-DE', { weekday: 'short'});
			date = dayOfWeek + ', ' + dd + '.' + mm + '.' + dateObject.getFullYear();
		}
		$('#time').text(time);
		$('#date').text(date);
	} else if ( mqttmsg == 'openWB/system/IpAddress') {
		$('#systemIpAddress').text(mqttpayload);
	} else if ( mqttmsg == 'openWB/system/wizzardDone' ) {
		if( mqttpayload == '100' ){
			$("#wizzardModal").modal("hide");
		} else {
			$("#wizzardModal").modal("show");
		}
	}

}

function processPvMessages(mqttmsg, mqttpayload) {
	// processes mqttmsg for topic openWB/pv
	// called by handlevar
	if ( mqttmsg == 'openWB/pv/W') {
		var pvwatt = parseInt(mqttpayload, 10);
		var unit = ' W';
		if ( isNaN(pvwatt) ) {
			pvwatt = 0;
		}
		if ( pvwatt > 0){
			pvwatt = 0;
		}
		if ( pvwatt < 0 ) {
			// production is negative for calculations so adjust for display
			pvwatt *= -1;
		}
		var pvwattText = pvwatt.toString();
		if (pvwatt > 999) {
			pvwattText = (pvwatt / 1000).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
			unit = ' kW';
		}
		var element = $('#pvl');
		var elementChart = $('#pvlchart');
		updateDashboardElement(element, elementChart, pvwattText + unit, pvwatt);
	}
	else if ( mqttmsg == 'openWB/pv/bool70PVDynStatus') {
		switch (mqttpayload) {
			case '0':
				// deaktiviert
				$('#70PvBtn').removeClass('btn-success');
				break;
			case '1':
				// ev priority
				$('#70PvBtn').addClass('btn-success');
			break;
		}
	}
	else if ( mqttmsg == 'openWB/pv/boolPVConfigured' ) {
		if ( mqttpayload == 1 ) {
			// if pv is configured, show info-cards
			$('.pv').removeClass('hide');
			// update sparklines
			$.sparkline_display_visible();
		} else {
			$('.pv').addClass('hide');
		}
	}
}

function processLpMessages(mqttmsg, mqttpayload) {
	// processes mqttmsg for topic openWB/lp
	// called by handlevar
	if ( mqttmsg.match( /^openwb\/lp\/[1-9][0-9]*\/w$/i ) ) {
		var index = getIndex(mqttmsg);  // extract number between two / /
		var parent = $('[data-lp="' + index + '"]');  // get parent row element for charge point
		var element = parent.find('.ladepunktll');  // now get parents respective child element
		var actualPower = parseInt(mqttpayload, 10);
		var unit = ' W';
		if ( isNaN(actualPower) ) {
			actualPower = 0;
		}
		var actualPowerText = actualPower.toString();
		if (actualPower > 999) {
			actualPowerText = (actualPower / 1000).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
			unit = ' kW';
		}
		var elementChart = parent.find('.ladepunktllchart');
		updateDashboardElement(element, elementChart, actualPowerText + unit, actualPower);
	}
	else if ( mqttmsg.match( /^openwb\/lp\/[1-9][0-9]*\/boolchargepointconfigured$/i ) ) {
		// respective charge point configured
		var index = getIndex(mqttmsg);  // extract number between two / /
		var element = $('[data-lp="' + index + '"]');
		// now show/hide element containing data-lp attribute with value=index
		switch (mqttpayload) {
			case '0':
				element.addClass('hide');
				break;
			case '1':
				element.removeClass('hide');
				// update sparklines
				$.sparkline_display_visible();
				break;
		}
	}
	else if ( mqttmsg.match( /^openwb\/lp\/[1-9][0-9]*\/autolockconfigured$/i ) ) {
		var index = getIndex(mqttmsg);  // extract first match = number from
		var parent = $('[data-lp="' + index + '"]');  // get parent row element for charge point
		var element = parent.find('.autolockConfiguredLp');  // now get parents respective child element
		if ( mqttpayload == 0 ) {
			element.addClass('hide');
		} else {
			element.removeClass('hide');
		}
	}
	else if ( mqttmsg.match( /^openwb\/lp\/[1-9][0-9]*\/autolockstatus$/i ) ) {
		// values used for AutolockStatus flag:
		// 0 = standby
		// 1 = waiting for autolock
		// 2 = autolock performed
		// 3 = auto-unlock performed
		var index = getIndex(mqttmsg);  // extract number between two / /
		var parent = $('[data-lp="' + index + '"]');  // get parent row element for charge point
		var element = parent.find('.autolockConfiguredLp');  // now get parents respective child element
		switch ( mqttpayload ) {
			case '0':
				// remove animation from span and set standard colored key icon
				element.removeClass('fa-lock fa-lock-open animate-alertPulsation text-red text-green');
				element.addClass('fa-key');
				break;
			case '1':
				// add animation to standard icon
				element.removeClass('fa-lock fa-lock-open text-red text-green');
				element.addClass('fa-key animate-alertPulsation');
				break;
			case '2':
				// add red locked icon
				element.removeClass('fa-lock-open fa-key animate-alertPulsation text-green');
				element.addClass('fa-lock text-red');
				break;
			case '3':
				// add green unlock icon
				element.removeClass('fa-lock fa-key animate-alertPulsation text-red');
				element.addClass('fa-lock-open text-green');
				break;
		}
	}
	else if ( mqttmsg.match( /^openwb\/lp\/[1-9][0-9]*\/strchargepointname$/i ) ) {
		var index = getIndex(mqttmsg);  // extract number between two / /
		var parent = $('[data-lp="' + index + '"]');  // get parent row element for charge point
		if( mqttpayload != 'LP'+index ){
			parent.find('.nameLp').text(mqttpayload+' (LP'+index+')');
		}
	}
	else if ( mqttmsg.match( /^openwb\/lp\/[1-9][0-9]*\/boolchargeatnight$/i ) ) {
		var index = getIndex(mqttmsg);  // extract number between two / /
		var parent = $('[data-lp="' + index + '"]');  // get parent row element for charge point
		var element = parent.find('.nightChargingLp');  // now get parents respective child element
		if ( mqttpayload == 1 ) {
			element.removeClass('hide');
		} else {
			element.addClass('hide');
		}
	}
	else if ( mqttmsg.match( /^openwb\/lp\/[1-9][0-9]*\/boolplugstat$/i ) ) {
		// status ev plugged in or not
		var index = getIndex(mqttmsg);  // extract number between two / /
		var parent = $('[data-lp="' + index + '"]');  // get parent row element for charge point
		var element = parent.find('.plugstatLp');  // now get parents respective child element
		if ( mqttpayload == 1 ) {
			element.removeClass('hide');
		} else {
			element.addClass('hide');
		}
	}
	else if ( mqttmsg.match( /^openwb\/lp\/[1-9][0-9]*\/boolchargestat$/i ) ) {
		var index = getIndex(mqttmsg);  // extract number between two / /
		var parent = $('[data-lp="' + index + '"]');  // get parent row element for charge point
		var element = parent.find('.plugstatLp');  // now get parents respective child element
		if ( mqttpayload == 1 ) {
			element.removeClass('text-warning').addClass('text-success');
		} else {
			element.removeClass('text-success').addClass('text-warning');
		}
	}
	else if ( mqttmsg.match( /^openwb\/lp\/[1-9][0-9]*\/chargepointenabled$/i ) ) {
		var index = getIndex(mqttmsg);  // extract number between two / /
		var parent = $('[data-lp="' + index + '"]');  // get parent row element for charge point
		var element = parent.find('.enableLp');  // now get parents respective child element
		if ( mqttpayload == 0 ) {
			element.addClass('lpDisabledStyle');
		} else {
			element.removeClass('lpDisabledStyle');
		}
	}
	else if ( mqttmsg.match( /^openwb\/lp\/[1-9][0-9]*\/countphasesinuse/i ) ) {
		var index = getIndex(mqttmsg);  // extract number between two / /
		var parent = $('[data-lp="' + index + '"]');  // get parent row element for charge point
		var element = parent.find('.phasesInUseLp');  // now get parents respective child element
		var phasesInUse = parseInt(mqttpayload, 10);
		if ( isNaN(phasesInUse) || phasesInUse < 1 || phasesInUse > 3 ) {
			element.text(' /');
		} else {
			var phaseSymbols = ['', '\u2460', '\u2461', '\u2462'];
			element.text(' ' + phaseSymbols[phasesInUse]);
		}
	}
	else if ( mqttmsg.match( /^openwb\/lp\/[1-9][0-9]*\/aconfigured$/i ) ) {
		// target current value at charge point
		var index = getIndex(mqttmsg);  // extract number between two / /
		var parent = $('[data-lp="' + index + '"]');  // get parent row element for charge point
		var element = parent.find('.targetCurrentLp');  // now get parents respective child element
		var targetCurrent = parseInt(mqttpayload, 10);
		if ( isNaN(targetCurrent) ) {
			element.text(' 0 A');
		} else {
			element.text(' ' + targetCurrent + ' A');
		}
	}
	else if ( mqttmsg.match( /^openwb\/lp\/[1-9][0-9]*\/boolsocconfigured$/i ) ) {
		// soc-module configured for respective charge point
		var index = getIndex(mqttmsg);  // extract number between two / /
		var parent = $('[data-lp="' + index + '"]');  // get parent row element for charge point
		var elementIsConfigured = $(parent).find('.socConfiguredLp');  // now get parents respective child element
		var elementIsNotConfigured = $(parent).find('.socNotConfiguredLp');  // now get parents respective child element
		if (mqttpayload == 1) {
			$(elementIsNotConfigured).addClass('hide');
			$(elementIsConfigured).removeClass('hide');
		} else {
			$(elementIsNotConfigured).removeClass('hide');
			$(elementIsConfigured).addClass('hide');
		}
	}
	else if ( mqttmsg.match( /^openwb\/lp\/[1-9][0-9]*\/\%soc$/i ) ) {
		// soc of ev at respective charge point
		var index = getIndex(mqttmsg);  // extract number between two / /
		var parent = $('[data-lp="' + index + '"]');  // get parent row element for charge point
		var element = parent.find('.socLp');  // now get parents respective child element
		var soc = parseInt(mqttpayload, 10);
		if ( isNaN(soc) || soc < 0 || soc > 100 ) {
			soc = '--';
		}
		element.text(soc + ' %');
	}
	else if ( mqttmsg.match( /^openwb\/lp\/[1-9][0-9]*\/boolfinishattimechargeactive$/i ) ) {
		// respective charge point configured
		var index = getIndex(mqttmsg);  // extract number between two / /
		var parent = $('[data-lp="' + index + '"]');  // get parent row element for charge point
		var element = parent.find('.targetChargingLp');  // now get parents respective child element
		if (mqttpayload == 1) {
			element.removeClass('hide');
		} else {
			element.addClass('hide');
		}
	}
}
