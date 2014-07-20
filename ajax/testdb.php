<?php
/**
 * This script opens the connection to the PostgreSQL database that is used throughout the program.
 * 
 * Multiple requires of this file  may do no harm,  if the function is "clever" enough to reuse the connection,
 * but should be avoided for clarity.
 * When transferring this file to a different server, the port of the DBMS may have to be adjusted.
 * 
 * @package main
 */

//require_once 'localization.php';
echo '<h2>Database Test</h2>'; 
//open sqlite3 database
$db_handle = new SQLite3('/var/www/websensepi/sqlite/mydatabase.db');

$result = $db_handle->query('SELECT * FROM bom ORDER BY tdate');

while ($row = $result->fetchArray()) {
      echo $row['tdate'].','.$row['mintemp'].','.$row['maxtemp'].','.$row['rainfall'].'<br>';
}

?>
