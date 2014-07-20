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
 
//open sqlite3 database
$db_handle = new SQLite3('/var/www/websensepi/sqlite/mydatabase.db');

?>
