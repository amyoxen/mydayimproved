package com.magicmac.myday.data

import java.time.LocalDate
import java.time.format.DateTimeFormatter

private val dayFormatter = DateTimeFormatter.ISO_LOCAL_DATE

fun todayKey(): String = LocalDate.now().format(dayFormatter)
