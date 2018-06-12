#!/bin/bash
set -e
set -o pipefail
cd /var/www/html/openWB/
#config file einlesen
. openwb.conf
re='^-?[0-9]+$'


#logfile aufräumen
if [[ $debug == "1" ]]; then
	echo "$(tail -100 /var/log/openWB.log)" > /var/log/openWB.log
fi
#######################################
# Werte für die Berechnung ermitteln
llalt=$(cat /var/www/html/openWB/ramdisk/llsoll)
#PV Leistung ermitteln
if [[ $pvwattmodul != "none" ]]; then
	pvwatt=$(modules/$pvwattmodul/main.sh)
	if ! [[ $pvwatt =~ $re ]] ; then
	 pvwatt="0"
	fi
	if [[ $debug == "1" ]]; then
                date
		echo pvwatt $pvwatt
        fi
else
	pvwatt=0
fi
#Wattbezug	i
if [[ $wattbezugmodul != "none" ]]; then
	wattbezug=$(modules/$wattbezugmodul/main.sh)
	if ! [[ $wattbezug =~ $re ]] ; then
	wattbezug="0"
	fi
	#uberschuss zur berechnung
	wattbezugint=$(printf "%.0f\n" $wattbezug)
	uberschuss=$(expr $wattbezugint \* -1)
	if [[ $debug == "1" ]]; then
		echo wattbezug $wattbezug
		echo uberschuss $uberschuss
	fi
	evua1=$(cat /var/www/html/openWB/ramdisk/bezuga1)
	evua2=$(cat /var/www/html/openWB/ramdisk/bezuga2)
	evua3=$(cat /var/www/html/openWB/ramdisk/bezuga3)

else
	wattbezug=$pvwatt
	wattbezugint=$(printf "%.0f\n" $wattbezug)
	wattbezugint=$(echo "($wattbezugint-300)" |bc)
	uberschuss=$wattbezugint
	
fi
#Ladeleistung ermitteln
if [[ $ladeleistungmodul != "none" ]]; then
	timeout 10 modules/$ladeleistungmodul/main.sh
	lla1=$(cat /var/www/html/openWB/ramdisk/lla1)
	lla2=$(cat /var/www/html/openWB/ramdisk/lla2)
	lla3=$(cat /var/www/html/openWB/ramdisk/lla3)	
	ladeleistung=$(cat /var/www/html/openWB/ramdisk/llaktuell)
		if ! [[ $lla1 =~ $re ]] ; then
		 lla1="0"
	fi
	if ! [[ $lla2 =~ $re ]] ; then
		 lla2="0"
	fi

	if ! [[ $lla3 =~ $re ]] ; then
		 lla3="0"
	fi
	if ! [[ $ladeleistung =~ $re ]] ; then
		 ladeleistung="0"
	fi

else
	lla1=0
	lla2=0
	lla3=0
	ladeleistung=0
fi
if [[ $lastmanagement == "1" ]]; then
	timeout 10 modules/$ladeleistungs1modul/main.sh
	ladeleistungslave1=$(cat /var/www/html/openWB/ramdisk/llaktuells1)
	llas1=$(cat /var/www/html/openWB/ramdisk/llas11)
	llas2=$(cat /var/www/html/openWB/ramdisk/llas12)
	llas3=$(cat /var/www/html/openWB/ramdisk/llas13)
	if ! [[ $ladeleistungslave1 =~ $re ]] ; then
	 ladeleistungslave1="0"
	fi
	ladeleistung=$(echo "($ladeleistung+$ladeleistungslave1)" |bc)
	echo $ladeleistung > /var/www/html/openWB/ramdisk/llkombiniert
else
	echo $ladeleistung > /var/www/html/openWB/ramdisk/llkombiniert
fi
	if [[ $debug == "1" ]]; then
                echo ladeleistung $ladeleistung llalt $llalt nachtladen $nachtladen minimalA $minimalstromstaerke maximalA $maximalstromstaerke
		echo lla1 $lla1 llas1 $llas1 mindestuberschuss $mindestuberschuss abschaltuberschuss $abschaltuberschuss
		echo lla2 $lla2 llas2 $llas2 sofortll $sofortll
		echo lla3 $lla3 llas3 $llas3
		echo evua 1,2,3 $evua1 $evua2 $evua3
        fi


#Soc ermitteln
if [[ $socmodul != "none" ]]; then
	soc=$(timeout 10 modules/$socmodul/main.sh)
	if ! [[ $soc =~ $re ]] ; then
	 soc="0"
	fi
	if [[ $debug == "1" ]]; then
                echo soc $soc
        fi
else
	soc=0
fi
#Uhrzeit
	date=$(date)
	H=$(date +%H)

#########################################
#Regelautomatiken


########################
# Sofort Laden
if grep -q 0 "/var/www/html/openWB/ramdisk/lademodus"; then
#zum test 1 durch 0 ersetzt
if [[ $lastmanagement == "0" ]]; then
	if grep -q 0 "/var/www/html/openWB/ramdisk/ladestatus"; then
		runs/$minimalstromstaerke.sh
		if [[ $debug == "1" ]]; then
	               	echo starte sofort Ladeleistung von $minimalstromstaerke aus
        	fi
		exit 0
	fi
	if grep -q 1 "/var/www/html/openWB/ramdisk/ladestatus"; then
		if (( $evua1 < $lastmaxap1 )) && (( $evua2 < $lastmaxap2 )) &&  (( $evua3 < $lastmaxap3 )); then
			if (( $ladeleistung < 500 )); then
				if (( $llalt > $minimalstromstaerke )); then
                                	llneu=$((llalt - 1 ))
                                	runs/"$llneu"m.sh
					if [[ $debug == "1" ]]; then
	       	             			echo "Sofort ladung reudziert auf $llneu bei minimal A $minimalstromstaerke Ladeleistung zu gering"
	     				fi
                                	exit 0
				fi
				if (( $llalt == $minimalstromstaerke )); then
					if [[ $debug == "1" ]]; then
	       	             			echo "Sofort ladung bei minimal A $minimalstromstaerke Ladeleistung zu gering"
	     				fi
					exit 0
				fi
				if (( $llalt < $minimalstromstaerke )); then
					llneu=$((llalt + 1 ))
					runs/"$llneu"m.sh
					if [[ $debug == "1" ]]; then
	       	             			echo "Sofort ladung erhöht auf $llneu bei minimal A $minimalstromstaerke Ladeleistung zu gering"
	     				fi
					exit 0
				fi

			else
				if (( $llalt == $sofortll )); then
					if [[ $debug == "1" ]]; then
	       	             			echo "Sofort ladung erreicht bei $sofortll A"
	     				fi
					exit 0

				fi
				if (( $llalt > $maximalstromstaerke )); then
					llneu=$((llalt - 1 ))
					runs/"$llneu"m.sh
					if [[ $debug == "1" ]]; then
	       	             			echo "Sofort ladung auf $llneu reduziert, über eingestellter max A $maximalstromstaerke"
	     				fi
					exit 0
				fi
				if (( $llalt < $sofortll)); then
					llneu=$((llalt + 1 ))
					runs/"$llneu"m.sh
		                	if [[ $debug == "1" ]]; then
	       	             			echo "Sofort ladung auf $llneu erhoeht, kleiner als sofortll $sofortll"
	     				fi
					exit 0
				fi
				if (( $llalt > $sofortll)); then
					llneu=$((llalt - 1 ))
					runs/"$llneu"m.sh
		                	if [[ $debug == "1" ]]; then
	       	             			echo "Sofort ladung auf $llneu reduziert, größer als sofortll $sofortll"
	     				fi
					exit 0
				fi

				 
			fi
		else
			evudiff1=$((evua1 - $lastmaxap1 ))
			evudiff2=$((evua2 - $lastmaxap2 ))
			evudiff3=$((evua3 - $lastmaxap3 ))
			evudiffmax=($evudiff1 $evudiff2 $evudiff3)
			maxdiff=0
			for v in ${evudiffmax[@]}; do
					if (( $v > $maxdiff )); then maxdiff=$v; fi;
			done
			maxdiff=$((maxdiff + 1 ))
			llneu=$((llalt - maxdiff))
			if (( $llneu < $minimalstromstaerke )); then
				llneu=$minimalstromstaerke
				if [[ $debug == "1" ]]; then
					echo Differenz groesser als minimalstromstaerke, setze auf minimal A $minimalstromstaerke
				fi
			fi
			runs/"$llneu"m.sh
	                if [[ $debug == "1" ]]; then
       	             		echo "Sofort ladung um $maxdiff auf $llneu reduziert"
     			fi
			exit 0

 		fi
	fi		
else
	if grep -q 1 "/var/www/html/openWB/ramdisk/ladestatus"; then
		if grep -q $sofortll "/var/www/html/openWB/ramdisk/llsoll"; then
			exit 0
		else
			runs/$sofortll.sh
			if [[ $debug == "1" ]]; then
	                	echo aendere sofort Ladeleistung auf $sofortll
	        	fi
			exit 0
		fi
	fi
	if grep -q 0 "/var/www/html/openWB/ramdisk/ladestatus"; then
		runs/$minimalstromstaerke.sh
		if [[ $debug == "1" ]]; then
			echo Starte sofort Ladeleistung mit Lastmanagement von $minimalstromstaerke aus
		fi
	exit 0
	fi


fi
fi

####################
# Nachtladung bzw. Ladung bis SOC x% nachts von x bis x Uhr
if [[ $nachtladen == "1" ]]; then
	if (( $nachtladenabuhr <= 10#$H && 10#$H <= 24 )) || (( 0 <= 10#$H && 10#$H <= $nachtladenbisuhr )); then
		dayoftheweek=$(date +%w)
		if [ $dayoftheweek -ge 0 -a $dayoftheweek -le 4 ]; then
		
			diesersoc=$nachtsoc
		else
			diesersoc=$nachtsoc1
		fi


		if [[ $socmodul != "none" ]]; then
			if [[ $debug == "1" ]]; then
                		echo nachtladen mit socmodul $socmodul
        		fi

			if (( $soc <= $diesersoc )); then
				if grep -q 0 "/var/www/html/openWB/ramdisk/ladestatus"; then
					runs/$nachtll.sh
					if [[ $debug == "1" ]]; then
		                		echo "soc $soc"
		        			echo "ladeleistung nachtladen bei $nachtll"
					fi
					exit 0
				fi
				if grep -q $nachtll "/var/www/html/openWB/ramdisk/llsoll"; then
					exit 0
				else
					runs/$nachtll.sh
					if [[ $debug == "1" ]]; then
	                		echo aendere nacht Ladeleistung auf $nachtll
	        			fi
				exit 0
				fi

				exit 0
			else
				if grep -q 1 "/var/www/html/openWB/ramdisk/ladestatus"; then
					runs/0.sh
					exit 0
				fi
				exit 0
			fi
		fi
		if [[ $socmodul == "none" ]]; then
			if grep -q 0 "/var/www/html/openWB/ramdisk/ladestatus"; then
			#	runs/ladungan.sh
                                runs/$nachtll.sh
                                if [[ $debug == "1" ]]; then
                                	echo "soc $soc"
                                        echo "ladeleistung nachtladen $nachtll A"
                                fi
                                echo "start Nachtladung mit $nachtll um $date" >> web/lade.log
                                exit 0
			fi
		exit 0
		fi	
	fi
fi
#######################
#Ladestromstarke berechnen
	llphasentest=$(expr $llalt - "3")

#Anzahl genutzter Phasen ermitteln, wenn ladestrom kleiner 3 (nicht vorhanden) nutze den letzten bekannten wert
if (( $llalt > 3 )); then
	anzahlphasen=0
	if [ $lla1 -ge $llphasentest ]; then
		anzahlphasen=$((anzahlphasen + 1 ))
	fi
	if [ $lla2 -ge $llphasentest ]; then
	        anzahlphasen=$((anzahlphasen + 1 ))
	fi
	if [ $lla3 -ge $llphasentest ]; then
	        anzahlphasen=$((anzahlphasen + 1 ))
	fi
	if [ $anzahlphasen -eq 0 ]; then
		anzahlphasen=1
	fi
	echo $anzahlphasen > /var/www/html/openWB/ramdisk/anzahlphasen
	else
	if [ ! -f /var/www/html/openWB/ramdisk/anzahlphasen ]; then
    		echo 1 > /var/www/html/openWB/ramdisk/anzahlphasen
	fi
	anzahlphasen=$(cat /var/www/html/openWB/ramdisk/anzahlphasen)
fi

########################
# Berechnung für PV Regelung
mindestuberschussphasen=$(echo "($mindestuberschuss*$anzahlphasen)" | bc)
wattkombiniert=$(echo "($ladeleistung+$uberschuss)" | bc)
abschaltungw=$(echo "(($abschaltuberschuss-1320)*-1*$anzahlphasen)" | bc)
schaltschwelle=$(echo "(230*$anzahlphasen)" | bc)

	if [[ $debug == "2" ]]; then
		echo $date
		echo uberschuss $uberschuss
		echo wattbezug $wattbezug
		echo `cat ramdisk/ladestatus`
		echo llsoll $llalt
		echo pvwatt $pvwatt
        echo mindestuberschussphasen $mindestuberschussphasen
		echo wattkombiniert $wattkombiniert
		echo abschaltungw $abschaltungw
		echo schaltschwelle $schaltschwelle
        fi
#PV Regelmodus
if [[ $pvbezugeinspeisung == "0" ]]; then
	pvregelungm="0"
fi


if [[ $pvbezugeinspeisung == "1" ]]; then
	pvregelungm=$(echo "(230*$anzahlphasen*-1)" | bc)
	schaltschwelle="0"
fi
########################
#Min Ladung + PV Uberschussregelung lademodus 1
if grep -q 1 "/var/www/html/openWB/ramdisk/lademodus"; then
	if grep -q 0 "/var/www/html/openWB/ramdisk/ladestatus"; then
		runs/$minimalstromstaerke.sh
		exit 0
                if [[ $debug == "1" ]]; then
                     	echo "starte min + pv ladung mit $minimalstromstaerke"
                fi
	fi
	if grep -q 1 "/var/www/html/openWB/ramdisk/ladestatus"; then
		if (( $ladeleistung < 500 )); then
			if (( $llalt > $minimalstromstaerke )); then
                                llneu=$((llalt - 1 ))
                                runs/$llneu.sh
                                exit 0
			fi
			if (( $llalt = $minimalstromstaerke )); then
                                exit 0
			fi
	
		fi	
		if (( $uberschuss < $pvregelungm )); then
                	if (( $llalt > $minimalstromstaerke )); then
                                llneu=$((llalt - 1 ))
                                runs/$llneu.sh
		                if [[ $debug == "1" ]]; then
        	             		echo "min + pv ladung auf $llneu reduziert"
               			fi
                                exit 0
                        else
				if (( $llalt < $minimalstromstaerke )); then
					llneu=$((llalt + 1 ))
					runs/$llneu.sh
				fi	
				exit 0
                        fi
                fi
		if (( $uberschuss > $schaltschwelle )); then
                        if (( $llalt == $maximalstromstaerke )); then
                                exit 0
                        fi
                        llneu=$((llalt + 1 ))
                        runs/$llneu.sh
	                if [[ $debug == "1" ]]; then
       	             		echo "min + pv ladung auf $llneu erhoeht"
     			fi
                	exit 0
		fi
	fi
fi
########################
#NUR PV Uberschussregelung lademodus 2
# wenn evse aus und $mindestuberschuss vorhanden, starte evse mit 6A Ladestromstaerke (1320 - 3960 Watt je nach Anzahl Phasen)
if grep -q 2 "/var/www/html/openWB/ramdisk/lademodus"; then
	if grep -q 0 "/var/www/html/openWB/ramdisk/ladestatus"; then
			if (( $mindestuberschussphasen <= $uberschuss )); then
		                if [[ $debug == "1" ]]; then
        	             		echo "nur  pv ladung auf $minimalstromstaerke starten"
               			fi
				runs/$minimalstromstaerke.sh
				echo 0 > /var/www/html/openWB/ramdisk/pvcounter 
				exit 0
			else
				exit 0
			fi	
	fi
	if (( $ladeleistung < 500 )); then
		if (( $llalt > $minimalstromstaerke )); then
                        llneu=$((llalt - 1 ))
                        runs/$llneu.sh
			echo 0 > /var/www/html/openWB/ramdisk/pvcounter 
                        exit 0
		fi
		if (( $llalt == $minimalstromstaerke )); then
                        if (( $wattbezugint > $abschaltuberschuss )); then 
				pvcounter=$(cat /var/www/html/openWB/ramdisk/pvcounter)
				if (( $pvcounter < $abschaltverzoegerung )); then
					pvcounter=$((pvcounter + 10))
					echo $pvcounter > /var/www/html/openWB/ramdisk/pvcounter
					if [[ $debug == "1" ]]; then
        	             			echo "Nur PV auf Minimalstromstaerke, PV Counter auf $pvcounter erhöht"
               				fi
				else
					runs/0.sh
					if [[ $debug == "1" ]]; then
						echo "pv ladung beendet"
					fi
					echo 0 > /var/www/html/openWB/ramdisk/pvcounter 
				fi
				exit 0
			fi
			exit 0
		fi
	fi	
	if grep -q 1 "/var/www/html/openWB/ramdisk/ladestatus"; then
			if (( $uberschuss > $schaltschwelle )); then
				if (( $llalt == $maximalstromstaerke )); then
					exit 0
				fi
				llneu=$((llalt + 1 ))
				if (( $llalt < $minimalstromstaerke )); then
					llneu=$minimalstromstaerke
				fi
				runs/$llneu.sh
		                if [[ $debug == "1" ]]; then
	       	             		echo "pv ladung auf $llneu erhoeht"
	     			fi
				echo 0 > /var/www/html/openWB/ramdisk/pvcounter 
				exit 0
			fi
			if (( $uberschuss < $pvregelungm )); then
				if (( $llalt > $minimalstromstaerke )); then
				      	llneu=$((llalt - 1 ))
	                                runs/$llneu.sh
					echo 0 > /var/www/html/openWB/ramdisk/pvcounter 
			                if [[ $debug == "1" ]]; then
						echo "pv ladung auf $llneu reduziert"
					fi
	                                exit 0
	                        else
					if (( $wattbezugint > $abschaltuberschuss )); then 
						pvcounter=$(cat /var/www/html/openWB/ramdisk/pvcounter)
						if (( $pvcounter < $abschaltverzoegerung )); then
							pvcounter=$((pvcounter + 10))
							echo $pvcounter > /var/www/html/openWB/ramdisk/pvcounter
							if [[ $debug == "1" ]]; then
        		             				echo "Nur PV auf Minimalstromstaerke, PV Counter auf $pvcounter erhöht"
               						fi
						else
							runs/0.sh
							if [[ $debug == "1" ]]; then
								echo "pv ladung beendet"
							fi
							echo 0 > /var/www/html/openWB/ramdisk/pvcounter 
						fi
					exit 0
					fi
	                        fi
			fi


	
	fi
fi

#Lademodus 3 == Aus

if grep -q 3 "/var/www/html/openWB/ramdisk/lademodus"; then
	if grep -q 1 "/var/www/html/openWB/ramdisk/ladestatus"; then
		runs/0.sh
		exit 0
	else
		exit 0
	fi
fi








