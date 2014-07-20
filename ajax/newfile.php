<?php

require 'opendb.php';


// Graphs and CSV should be bookmarkable. Clients caching the output would make that impossible.
//disableClientCaching();

//TODO push legend labels etc. too
//$dataarray = array (
//		array(DATE, MINTEMP, MAXTEMP, RAINFALL)
//);

//The array that's used to create the graph
$dataarray = array();
//TODO push legend labels etc. too


//$fp = fopen('samplefile.csv', 'w');

$result = $db_handle->query('SELECT * FROM bom ORDER BY tdate');

//while ($row = $res->fetchArray()) {
//	array_push($dataarray, array($row['tdate'],$row['mintemp'],$row['maxtemp'],$row['rainfall']));
//}

//$result = $db_handle->query($valuequery);
//$nsensors = 3;
while ($row = $result->fetchArray()) {
	$point = new stdClass();
	$point->DATE = $row['tdate'];
	$point->MINTEMP = $row['mintemp'];
	$point->MAXTEMP = $row['maxtemp'];
	$point->RAINFALL = $row['rainfall'];
	
	array_push($dataarray, $point);
}

/*
foreach ($list as $fields) {
	fputcsv($fp, $fields);
}

fclose($fp);
*/

echo json_encode($dataarray);
?>