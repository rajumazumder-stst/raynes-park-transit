# Documentation for Live Departure Boards Web Service (LDBWS)

## What is it?

LDBWS provides a request-response web service to access real time train information from Darwin. This is the same information that powers the Live Departure Boards, provided in JSON format.

## Where is it?

The LDBWS OpenAPI JSON Spec file may be found under 'Reference Material' in the 'Documentation' tab of any API data product for the Live Departure Boards Web Service.

To make this JSON specification more human friendly to read, download the file, open it in a text editor, and copy 'n paste into, for example, the online Swagger Editor, found here: https://editor.swagger.io.

> **PLEASE NOTE: When passing CRS data**
> Any `crs` value passed as a parameter should be fully UPPERCASE, whether it is a single parameter or part of a List.

## How is it accessed?

LDBWS is an OpenAPI web service that is now accessible via the Rail Data Marketplace in the form of an API data product.

Users who subscribe to an API data product in the Rail Data Marketplace will be given credentials and can use these to call the API and retrieve data from the Live Arrival and Departure Boards.

For those operations requiring a CRS code or codes to function, a list may be obtained at http://www.nationalrail.co.uk/stations_destinations/48541.aspx.

---

## Supported Operations

Some operations may only be available in specific versions of the service. Check the individual operation descriptions for more information.

### GetArrBoardWithDetails

**Version:** 2015-05-14 and above.

**Description:** Returns all public arrivals for the supplied CRS code within a defined time window, including service details.

**Parameters:** All parameters must be supplied, but may be null. Parameters that may be null are marked optional.

- `numRows` (integer, between 0 and 10 exclusive): The number of services to return in the resulting station board.
- `crs` (string, 3 characters, alphabetic): The CRS code of the location for which the request is being made.
- `filterCrs` (string, 3 characters, alphabetic): The CRS code of either an origin or destination location to filter in. *Optional.*
- `filterType` (string, either "from" or "to"): The type of filter to apply. Filters services to include only those originating or terminating at the filterCrs location. Defaults to "to". *Optional.*
- `timeOffset` (integer, between -120 and 120 exclusive): An offset in minutes against the current time to provide the station board for. Defaults to 0. *Optional.*
- `timeWindow` (integer, between -120 and 120 exclusive): How far into the future in minutes, relative to timeOffset, to return services for.

**Response:** A `StationBoardWithDetails` object containing the requested details.

### GetArrDepBoardWithDetails

**Version:** 2015-05-14 and above.

**Description:** Returns all public arrivals and departures for the supplied CRS code within a defined time window, including service details.

**Parameters:** All parameters must be supplied, but may be null. Parameters that may be null are marked optional.

- `numRows` (integer, between 0 and 10 exclusive): The number of services to return in the resulting station board.
- `crs` (string, 3 characters, alphabetic): The CRS code of the location for which the request is being made.
- `filterCrs` (string, 3 characters, alphabetic): The CRS code of either an origin or destination location to filter in. *Optional.*
- `filterType` (string, either "from" or "to"): The type of filter to apply. Filters services to include only those originating or terminating at the filterCrs location. Defaults to "to". *Optional.*
- `timeOffset` (integer, between -120 and 120 exclusive): An offset in minutes against the current time to provide the station board for. Defaults to 0. *Optional.*
- `timeWindow` (integer, between -120 and 120 exclusive): How far into the future in minutes, relative to timeOffset, to return services for.

**Response:** A `StationBoardWithDetails` object containing the requested details.

### GetArrivalBoard

**Description:** Returns all public arrivals for the supplied CRS code within a defined time window.

**Parameters:** All parameters must be supplied, but may be null. Parameters that may be null are marked optional.

- `numRows` (integer, between 0 and 150 exclusive): The number of services to return in the resulting station board.
- `crs` (string, 3 characters, alphabetic): The CRS code of the location for which the request is being made.
- `filterCrs` (string, 3 characters, alphabetic): The CRS code of either an origin or destination location to filter in. *Optional.*
- `filterType` (string, either "from" or "to"): The type of filter to apply. Filters services to include only those originating or terminating at the filterCrs location. Defaults to "to". *Optional.*
- `timeOffset` (integer, between -120 and 120 exclusive): An offset in minutes against the current time to provide the station board for. Defaults to 0. *Optional.*
- `timeWindow` (integer, between -120 and 120 exclusive): How far into the future in minutes, relative to timeOffset, to return services for.

**Response:** A `StationBoard` object containing the requested details.

### GetArrivalDepartureBoard

**Description:** Returns all public arrivals and departures for the supplied CRS code within a defined time window.

**Parameters:** All parameters must be supplied, but may be null. Parameters that may be null are marked optional.

- `numRows` (integer, between 0 and 150 exclusive): The number of services to return in the resulting station board.
- `crs` (string, 3 characters, alphabetic): The CRS code of the location for which the request is being made.
- `filterCrs` (string, 3 characters, alphabetic): The CRS code of either an origin or destination location to filter in. *Optional.*
- `filterType` (string, either "from" or "to"): The type of filter to apply. Filters services to include only those originating or terminating at the filterCrs location. Defaults to "to". *Optional.*
- `timeOffset` (integer, between -120 and 120 exclusive): An offset in minutes against the current time to provide the station board for. Defaults to 0. *Optional.*
- `timeWindow` (integer, between -120 and 120 exclusive): How far into the future in minutes, relative to timeOffset, to return services for.

**Response:** A `StationBoard` object containing the requested details.

### GetDepartureBoard

**Description:** Returns all public departures for the supplied CRS code within a defined time window.

**Parameters:** All parameters must be supplied, but may be null. Parameters that may be null are marked optional.

- `numRows` (integer, between 0 and 150 exclusive): The number of services to return in the resulting station board.
- `crs` (string, 3 characters, alphabetic): The CRS code of the location for which the request is being made.
- `filterCrs` (string, 3 characters, alphabetic): The CRS code of either an origin or destination location to filter in. *Optional.*
- `filterType` (string, either "from" or "to"): The type of filter to apply. Filters services to include only those originating or terminating at the filterCrs location. Defaults to "to". *Optional.*
- `timeOffset` (integer, between -120 and 120 exclusive): An offset in minutes against the current time to provide the station board for. Defaults to 0. *Optional.*
- `timeWindow` (integer, between -120 and 120 exclusive): How far into the future in minutes, relative to timeOffset, to return services for.

**Response:** A `StationBoard` object containing the requested details.

### GetDepBoardWithDetails

**Version:** 2015-05-14 and above.

**Description:** Returns all public departures for the supplied CRS code within a defined time window, including service details.

**Parameters:** All parameters must be supplied, but may be null. Parameters that may be null are marked optional.

- `numRows` (integer, between 0 and 10 exclusive): The number of services to return in the resulting station board.
- `crs` (string, 3 characters, alphabetic): The CRS code of the location for which the request is being made.
- `filterCrs` (string, 3 characters, alphabetic): The CRS code of either an origin or destination location to filter in. *Optional.*
- `filterType` (string, either "from" or "to"): The type of filter to apply. Filters services to include only those originating or terminating at the filterCrs location. Defaults to "to". *Optional.*
- `timeOffset` (integer, between -120 and 120 exclusive): An offset in minutes against the current time to provide the station board for. Defaults to 0. *Optional.*
- `timeWindow` (integer, between -120 and 120 exclusive): How far into the future in minutes, relative to timeOffset, to return services for.

**Response:** A `StationBoardWithDetails` object containing the requested details.

### GetFastestDepartures

**Version:** 2015-05-14 and above.

**Description:** Returns the public departure for the supplied CRS code within a defined time window to the locations specified in the filter with the earliest arrival time at the filtered location.

**Parameters:** All parameters must be supplied, but may be null. Parameters that may be null are marked optional.

- `crs` (string, 3 characters, alphabetic): The CRS code of the location for which the request is being made.
- `filterList` (a list): A list of CRS codes of the destination locations to filter; at least 1 but not greater than 15 must be supplied.
- `timeOffset` (integer, between -120 and 120 exclusive): An offset in minutes against the current time to provide the station board for. Defaults to 0. *Optional.*
- `timeWindow` (integer, between -120 and 120 exclusive): How far into the future in minutes, relative to timeOffset, to return services for.

**Response:** A `DeparturesBoard` object containing the requested details.

### GetFastestDeparturesWithDetails

**Version:** 2015-05-14 and above.

**Description:** Returns the public departure for the supplied CRS code within a defined time window to the locations specified in the filter with the earliest arrival time at the filtered location, including service details.

**Parameters:** All parameters must be supplied, but may be null. Parameters that may be null are marked optional.

- `crs` (string, 3 characters, alphabetic): The CRS code of the location for which the request is being made.
- `filterList` (a list): A list of CRS codes of the destination locations to filter; at least 1 but not greater than 10 must be supplied.
- `timeOffset` (integer, between -120 and 120 exclusive): An offset in minutes against the current time to provide the station board for. Defaults to 0. *Optional.*
- `timeWindow` (integer, between -120 and 120 exclusive): How far into the future in minutes, relative to timeOffset, to return services for.

**Response:** A `DeparturesBoardWithDetails` object containing the requested details.

### GetNextDepartures

**Version:** 2015-05-14 and above.

**Description:** Returns the next public departure for the supplied CRS code within a defined time window to the locations specified in the filter.

**Parameters:** All parameters must be supplied, but may be null. Parameters that may be null are marked optional.

- `crs` (string, 3 characters, alphabetic): The CRS code of the location for which the request is being made.
- `filterList` (a list): A list of CRS codes of the destination locations to filter; at least 1 but not greater than 25 must be supplied.
- `timeOffset` (integer, between -120 and 120 exclusive): An offset in minutes against the current time to provide the station board for. Defaults to 0. *Optional.*
- `timeWindow` (integer, between -120 and 120 exclusive): How far into the future in minutes, relative to timeOffset, to return services for.

**Response:** A `DeparturesBoard` object containing the requested details.

### GetNextDeparturesWithDetails

**Version:** 2015-05-14 and above.

**Description:** Returns the next public departure for the supplied CRS code within a defined time window to the locations specified in the filter, including service details.

**Parameters:** All parameters must be supplied, but may be null. Parameters that may be null are marked optional.

- `crs` (string, 3 characters, alphabetic): The CRS code of the location for which the request is being made.
- `filterList` (a list): A list of CRS codes of the destination locations to filter; at least 1 but not greater than 10 must be supplied.
- `timeOffset` (integer, between -120 and 120 exclusive): An offset in minutes against the current time to provide the station board for. Defaults to 0. *Optional.*
- `timeWindow` (integer, between -120 and 120 exclusive): How far into the future in minutes, relative to timeOffset, to return services for.

**Response:** A `DeparturesBoardWithDetails` object containing the requested details.

### GetServiceDetails

**Description:** Returns service details for a specific service identified by a station board. These details are supplied relative to the station board from which the serviceID field value was generated. Service details are only available while the service appears on the station board from which it was obtained. This is normally for two minutes after it is expected to have departed, or after a terminal arrival. If a request is made for a service that is no longer available then a null value is returned.

**Parameters:** All parameters must be supplied, but may be null. Parameters that may be null are marked optional.

- `serviceID` (string): The LDBWS service ID of the service to request the details of. The service ID is obtained from a service listed in a `StationBoard` object returned from any other request.

**Response:** A `ServiceDetails` object containing the requested details.

> If an error occurs during execution of an operation (including detection of invalid parameter values, or the unavailability of the underlying LDB service), it will be communicated back to the client by means of a SOAP Fault. This will usually be translated by the user's proxy generation tools to an exception in the generated language code.

---

## Objects

### CallingPoint

The calling point lists in the `ServiceDetails` object need further explanation. It is possible for certain trains to be formed from multiple separate trains, or to split into multiple trains, at certain points in their schedule. In such circumstances, some trains may have multiple origins or destinations and therefore there may be multiple lists of calling points in the `previousCallingPoints` or `subsequentCallingPoints` properties. The first list of calling points will be for the "through" train and will hold all of the locations from the origin (for `previousCallingPoints`) or to the destination (for `subsequentCallingPoints`). The remaining lists will hold the locations of joining/splitting trains from/to their respective origins/destinations. The point at which the association is made is determined by examining the last location in the `previousCallingPoints` list, or the first location in the `subsequentCallingPoints` list. To get a better idea of how this works, look at a Train Details page on the LDB web site for a train that has an association. A good station to look for such trains would be Gatwick Airport [GTW].

| Member | Description |
|--------|-------------|
| `locationName` | The display name of this location. |
| `crs` | The CRS code of this location. A CRS code of `???` indicates an error situation where no crs code is known for this location. |
| `st` | The scheduled time of the service at this location. The time will be either an arrival or departure time, depending on whether it is in the subsequent or previous calling point list. |
| `et` | The estimated time of the service at this location. The time will be either an arrival or departure time, depending on whether it is in the subsequent or previous calling point list. Will only be present if an actual time (`at`) is not present. |
| `at` | The actual time of the service at this location. The time will be either an arrival or departure time, depending on whether it is in the subsequent or previous calling point list. Will only be present if an estimated time (`et`) is not present. |
| `isCancelled` | A flag to indicate that this service is cancelled at this location. |
| `length` | The train length (number of units) at this location. If not supplied, or zero, the length is unknown. |
| `detachFront` | True if the service detaches units from the front at this location. |
| `adhocAlerts` | A list of Adhoc Alerts (strings) for this CallingPoint. |
| `uncertainty` | UncertaintyType for this ServiceItem, if any. |
| `affectedBy` | The NRE incident number. |

### CoachData

| Member | Description |
|--------|-------------|
| `coachClass` | The class of coach, where known. First, Mixed or Standard. Other classes may be introduced in the future. |
| `loading` | The loading value (0-100) for the coach. |
| `loadingSpecified` | Whether loading has been specified or not. |
| `number` | The number/identifier for this coach, e.g. "A" or "12". Maximum of two characters. |
| `toilet` | A ToiletAvailabilityType object representing toilet data. (2017-10-01 schema onwards) |

### DepartureItem

| Member | Description |
|--------|-------------|
| `crs` | The CRS code of the location that the Departure Item represents. |
| `service` | A list of ServiceItem objects for the CRS code. |

### DepartureItemWithCallingPoints

| Member | Description |
|--------|-------------|
| `crs` | The CRS code of the location that the Departure Item represents. |
| `service` | A list of ServiceItemWithCallingPoints objects for the CRS code. |

### DeparturesBoard

| Member | Description |
|--------|-------------|
| `generatedAt` | The time at which the station board was generated. |
| `locationName` | The name of the location that the station board is for. |
| `crs` | The CRS code of the location that the station board is for. |
| `filterLocationName` | If a filter was requested, the location name of the filter location. |
| `filtercrs` | If a filter was requested, the CRS code of the filter location. |
| `filterType` | If a filter was requested, the type of filter. |
| `nrccMessages` | An optional list of textual messages that should be displayed with the station board. The message may include embedded and xml encoded HTML-like hyperlinks and paragraphs. The messages are typically used to display important disruption information that applies to the location that the station board was for. Any embedded `<p>` tags are used to force a new-line in the output. Embedded `<a>` tags allow links to external web pages that may provide more information. Output channels that do not support HTML should strip out the `<a>` tags and just leave the enclosed text. |
| `platformAvailable` | An optional value that indicates if platform information is available. If this value is present with the value "true" then platform information will be returned in the service lists. If this value is not present, or has the value "false", then the platform "heading" should be suppressed in the user interface for this station board. |
| `areServicesAvailable` | An optional value that indicates if services are currently available for this station board. If this value is present with the value "false" then no services will be returned in the service lists. This value may be set, for example, if access to a station has been closed to the public at short notice, even though the scheduled services are still running. It would be usual in such cases for one of the nrccMessages to describe why the list of services has been suppressed. |
| `departures` | The DepartureItem object for each service that is to appear on the station board. A DepartureItem will exist for each CRS code requested in the filter but if no information is available the ServiceItem part will be empty. |

### DeparturesBoardWithDetails

| Member | Description |
|--------|-------------|
| `generatedAt` | The time at which the station board was generated. |
| `locationName` | The name of the location that the station board is for. |
| `crs` | The CRS code of the location that the station board is for. |
| `filterLocationName` | If a filter was requested, the location name of the filter location. |
| `filtercrs` | If a filter was requested, the CRS code of the filter location. |
| `filterType` | If a filter was requested, the type of filter. |
| `nrccMessages` | An optional list of textual messages that should be displayed with the station board. The message may include embedded and xml encoded HTML-like hyperlinks and paragraphs. The messages are typically used to display important disruption information that applies to the location that the station board was for. Any embedded `<p>` tags are used to force a new-line in the output. Embedded `<a>` tags allow links to external web pages that may provide more information. Output channels that do not support HTML should strip out the `<a>` tags and just leave the enclosed text. |
| `platformAvailable` | An optional value that indicates if platform information is available. If this value is present with the value "true" then platform information will be returned in the service lists. If this value is not present, or has the value "false", then the platform "heading" should be suppressed in the user interface for this station board. |
| `areServicesAvailable` | An optional value that indicates if services are currently available for this station board. If this value is present with the value "false" then no services will be returned in the service lists. This value may be set, for example, if access to a station has been closed to the public at short notice, even though the scheduled services are still running. It would be usual in such cases for one of the nrccMessages to describe why the list of services has been suppressed. |
| `departures` | The DepartureItemWithCallingPoints object for each service that is to appear on the station board. A DepartureItemWithCallingPoints will exist for each CRS code requested in the filter but if no information is available the ServiceItemWithCallingPoints part will be empty. |

### FormationData

| Member | Description |
|--------|-------------|
| `loadingCategory` | An optional LoadingCategory object containing the loading category information for this formation. |
| `coaches` | A collection of CoachData objects related to this formation. |

### LoadingCategory

| Member | Description |
|--------|-------------|
| `code` | The train loading category code. |
| `colour` | The colour to be used when displaying this category. |
| `image` | Name of an image file to be used as an icon for this category. |

### ServiceDetails

| Member | Description |
|--------|-------------|
| `generatedAt` | The time at which the service details were generated. |
| `rsid` | The Retail Service ID of the service, if known. |
| `serviceType` | The type of service (train, bus, ferry) that these details represent. Note that real-time information (e.g. eta, etd, ata, atd, isCancelled, etc.) is only available and present for train services. |
| `locationName` | The display name of the departure board location that these service details were accessed from. |
| `crs` | The CRS code of the departure board location that these service details were accessed from. |
| `operator` | The display name of the Train Operating Company that operates this service. |
| `operatorCode` | The code of the Train Operating Company that operates this service. |
| `isCancelled` | Indicates that the service is cancelled at this location. |
| `cancelReason` | A cancellation reason for this service. |
| `delayReason` | A delay reason for this service. |
| `detachFront` | True if the service detaches units from the front at this location. |
| `diversionReason` | The reason for a diversion. |
| `divertedVia` | The location of the diversion. |
| `overdueMessage` | If an expected movement report has been missed, this will contain a message describing the missed movement. |
| `length` | The train length (number of units) at this location. If not supplied, or zero, the length is unknown. |
| `isReverseFormation` | True if the service is operating in the reverse of its normal formation. |
| `platform` | The platform number that the service is expected to use at this location, if known and available. |
| `sta` | The scheduled time of arrival of this service at this location. If no sta is present then this is the origin of this service or it does not set down passengers at this location. |
| `eta` | The estimated time of arrival. Will only be present if sta is also present and ata is not present. |
| `ata` | The actual time of arrival. Will only be present if sta is also present and eta is not present. |
| `std` | The scheduled time of departure of this service at this location. If no std is present then this is the destination of this service or it does not pick up passengers at this location. |
| `etd` | The estimated time of departure. Will only be present if std is also present and atd is not present. |
| `atd` | The actual time of departure. Will only be present if std is also present and etd is not present. |
| `adhocAlerts` | A list of Adhoc Alerts (strings) for this ServiceDetail. |
| `previousCallingPoints` | A list of lists of CallingPoint objects representing the previous calling points in the journey. A separate calling point list will be present for each origin of the service, relative to the current location. |
| `subsequentCallingPoints` | A list of lists of CallingPoint objects representing the subsequent calling points in the journey. A separate calling point list will be present for each destination of the service, relative to the current location. |
| `formation` | A list of FormationData representing the formation of the service. |

### ServiceItem

| Member | Description |
|--------|-------------|
| `rsid` | The Retail Service ID of the service, if known. |
| `origin` | A list of ServiceLocation objects giving original origins of this service. Note that a service may have more than one original origin, if the service comprises of multiple trains that join at a previous location in the schedule. Original Origins will only be available for Arrival and Arrival & Departure station boards. |
| `destination` | A list of ServiceLocation objects giving original destinations of this service. Note that a service may have more than one original destination, if the service comprises of multiple trains that divide at a subsequent location in the schedule. Original Destinations will only be available for Departure and Arrival & Departure station boards. |
| `currentOrigins` | An optional list of ServiceLocation objects giving live/current origins of this service which is not starting at original cancelled origins. Note that a service may have more than one live origin, if the service comprises of multiple trains that join at a previous location in the schedule. Live Origins will only be available for Arrival and Arrival & Departure station boards. |
| `currentDestinations` | An optional list of ServiceLocation objects giving live/current destinations of this service which is not ending at original cancelled destinations. Note that a service may have more than one live destination, if the service comprises of multiple trains that divide at a subsequent location in the schedule. Live Destinations will only be available for Departure and Arrival & Departure station boards. |
| `sta` | An optional Scheduled Time of Arrival of the service at the station board location. Arrival times will only be available for Arrival and Arrival & Departure station boards but may also not be present at locations that are not scheduled to arrive at the location (e.g. the origin). |
| `eta` | An optional Estimated Time of Arrival of the service at the station board location. Arrival times will only be available for Arrival and Arrival & Departure station boards and only where an sta time is present. |
| `std` | An optional Scheduled Time of Departure of the service at the station board location. Departure times will only be available for Departure and Arrival & Departure station boards but may also not be present at locations that are not scheduled to depart at the location (e.g. the destination). |
| `etd` | An optional Estimated Time of Departure of the service at the station board location. Departure times will only be available for Departure and Arrival & Departure station boards and only where an std time is present. |
| `platform` | An optional platform number for the service at this location. This will only be present where available and where the station board platformAvailable value is "true". |
| `operator` | The name of the Train Operating Company that operates the service. |
| `operatorCode` | The code of the Train Operating Company that operates the service. |
| `isCircularRoute` | If this value is present and has the value "true" then the service is operating on a circular route through the network and will call again at this location later on its journey. The user interface should indicate this fact to the user, to help them choose the correct service from a set of similar alternatives. |
| `isCancelled` | A flag to indicate that this service is cancelled at this location. |
| `filterLocationCancelled` | A flag to indicate that this service is no longer stopping at the requested from/to filter location. |
| `serviceType` | The type of service (train, bus, ferry) that this item represents. Note that real-time information (e.g. eta, etd, ata, atd, etc.) is only available and present for train services. |
| `length` | The train length (number of units) at this location. If not supplied, or zero, the length is unknown. |
| `detachFront` | True if the service detaches units from the front at this location. |
| `isReverseFormation` | True if the service is operating in the reverse of its normal formation. |
| `cancelReason` | A cancellation reason for this service. |
| `delayReason` | A delay reason for this service. |
| `serviceID` | The unique service identifier of this service relative to the station board on which it is displayed. This value can be passed to GetServiceDetails to obtain the full details of the individual service. |
| `adhocAlerts` | A list of Adhoc Alerts (strings) for this ServiceItem. |
| `formation` | FormationData for this ServiceItem, if any. |
| `uncertainty` | UncertaintyType for this ServiceItem, if any. |
| `affectedBy` | The NRE incident number. |

### ServiceItemWithCallingPoints

| Member | Description |
|--------|-------------|
| `origin` | A list of ServiceLocation objects giving original origins of this service. Note that a service may have more than one original origin, if the service comprises of multiple trains that join at a previous location in the schedule. Original Origins will only be available for Arrival and Arrival & Departure station boards. |
| `destination` | A list of ServiceLocation objects giving original destinations of this service. Note that a service may have more than one original destination, if the service comprises of multiple trains that divide at a subsequent location in the schedule. Original Destinations will only be available for Departure and Arrival & Departure station boards. |
| `currentOrigins` | An optional list of ServiceLocation objects giving live/current origins of this service which is not starting at original cancelled origins. Note that a service may have more than one live origin, if the service comprises of multiple trains that join at a previous location in the schedule. Live Origins will only be available for Arrival and Arrival & Departure station boards. |
| `currentDestinations` | An optional list of ServiceLocation objects giving live/current destinations of this service which is not ending at original cancelled destinations. Note that a service may have more than one live destination, if the service comprises of multiple trains that divide at a subsequent location in the schedule. Live Destinations will only be available for Departure and Arrival & Departure station boards. |
| `sta` | An optional Scheduled Time of Arrival of the service at the station board location. Arrival times will only be available for Arrival and Arrival & Departure station boards but may also not be present at locations that are not scheduled to arrive at the location (e.g. the origin). |
| `eta` | An optional Estimated Time of Arrival of the service at the station board location. Arrival times will only be available for Arrival and Arrival & Departure station boards and only where an sta time is present. |
| `std` | An optional Scheduled Time of Departure of the service at the station board location. Departure times will only be available for Departure and Arrival & Departure station boards but may also not be present at locations that are not scheduled to depart at the location (e.g. the destination). |
| `etd` | An optional Estimated Time of Departure of the service at the station board location. Departure times will only be available for Departure and Arrival & Departure station boards and only where an std time is present. |
| `platform` | An optional platform number for the service at this location. This will only be present where available and where the station board platformAvailable value is "true". |
| `operator` | The name of the Train Operating Company that operates the service. |
| `operatorCode` | The code of the Train Operating Company that operates the service. |
| `isCircularRoute` | If this value is present and has the value "true" then the service is operating on a circular route through the network and will call again at this location later on its journey. The user interface should indicate this fact to the user, to help them choose the correct service from a set of similar alternatives. |
| `isCancelled` | A flag to indicate that this service is cancelled at this location. |
| `filterLocationCancelled` | A flag to indicate that this service is no longer stopping at the requested from/to filter location. |
| `serviceType` | The type of service (train, bus, ferry) that this item represents. Note that real-time information (e.g. eta, etd, ata, atd, etc.) is only available and present for train services. |
| `length` | The train length (number of units) at this location. If not supplied, or zero, the length is unknown. |
| `detachFront` | True if the service detaches units from the front at this location. |
| `isReverseFormation` | True if the service is operating in the reverse of its normal formation. |
| `cancelReason` | A cancellation reason for this service. |
| `delayReason` | A delay reason for this service. |
| `serviceID` | The unique service identifier of this service relative to the station board on which it is displayed. This value can be passed to GetServiceDetails to obtain the full details of the individual service. |
| `adhocAlerts` | A list of Adhoc Alerts (strings) for this ServiceItemWithCallingPoints. |
| `previousCallingPoints` | A list of CallingPoint objects relative to this location for this service. |
| `subsequentCallingPoints` | A list of CallingPoint objects relative to this location for this service. |
| `uncertainty` | UncertaintyType for this ServiceItem, if any. |
| `affectedBy` | The NRE incident number. |

### ServiceLocation

| Member | Description |
|--------|-------------|
| `locationName` | The name of the location. |
| `crs` | The CRS code of this location. A CRS code of `???` indicates an error situation where no crs code is known for this location. |
| `via` | An optional via text that should be displayed after the location, to indicate further information about an ambiguous route. Note that vias are only present for ServiceLocation objects that appear in destination lists. |
| `futureChangeTo` | A text string containing service type (Bus/Ferry/Train) to which will be changed in the future. |
| `assocIsCancelled` | This origin or destination can no longer be reached because the association has been cancelled. |

### StationBoard

| Member | Description |
|--------|-------------|
| `generatedAt` | The time at which the station board was generated. |
| `locationName` | The name of the location that the station board is for. |
| `crs` | The CRS code of the location that the station board is for. |
| `filterLocationName` | If a filter was requested, the location name of the filter location. |
| `filtercrs` | If a filter was requested, the CRS code of the filter location. |
| `filterType` | If a filter was requested, the type of filter. |
| `nrccMessages` | An optional list of textual messages that should be displayed with the station board. The message may include embedded and xml encoded HTML-like hyperlinks and paragraphs. The messages are typically used to display important disruption information that applies to the location that the station board was for. Any embedded `<p>` tags are used to force a new-line in the output. Embedded `<a>` tags allow links to external web pages that may provide more information. Output channels that do not support HTML should strip out the `<a>` tags and just leave the enclosed text. |
| `platformAvailable` | An optional value that indicates if platform information is available. If this value is present with the value "true" then platform information will be returned in the service lists. If this value is not present, or has the value "false", then the platform "heading" should be suppressed in the user interface for this station board. |
| `areServicesAvailable` | An optional value that indicates if services are currently available for this station board. If this value is present with the value "false" then no services will be returned in the service lists. This value may be set, for example, if access to a station has been closed to the public at short notice, even though the scheduled services are still running. It would be usual in such cases for one of the nrccMessages to describe why the list of services has been suppressed. |
| `trainServices` / `busServices` / `ferryServices` | Each of these lists contains a ServiceItem object for each service of the relevant type that is to appear on the station board. Each or all of these lists may contain zero items, or may not be present at all. |

### StationBoardWithDetails

| Member | Description |
|--------|-------------|
| `generatedAt` | The time at which the station board was generated. |
| `locationName` | The name of the location that the station board is for. |
| `crs` | The CRS code of the location that the station board is for. |
| `filterLocationName` | If a filter was requested, the location name of the filter location. |
| `filtercrs` | If a filter was requested, the CRS code of the filter location. |
| `filterType` | If a filter was requested, the type of filter. |
| `nrccMessages` | An optional list of textual messages that should be displayed with the station board. The message may include embedded and xml encoded HTML-like hyperlinks and paragraphs. The messages are typically used to display important disruption information that applies to the location that the station board was for. Any embedded `<p>` tags are used to force a new-line in the output. Embedded `<a>` tags allow links to external web pages that may provide more information. Output channels that do not support HTML should strip out the `<a>` tags and just leave the enclosed text. |
| `platformAvailable` | An optional value that indicates if platform information is available. If this value is present with the value "true" then platform information will be returned in the service lists. If this value is not present, or has the value "false", then the platform "heading" should be suppressed in the user interface for this station board. |
| `areServicesAvailable` | An optional value that indicates if services are currently available for this station board. If this value is present with the value "false" then no services will be returned in the service lists. This value may be set, for example, if access to a station has been closed to the public at short notice, even though the scheduled services are still running. It would be usual in such cases for one of the nrccMessages to describe why the list of services has been suppressed. |
| `trainServices` / `busServices` / `ferryServices` | Each of these lists contains a ServiceItemWithCallingPoints object for each service of the relevant type that is to appear on the station board. Each or all of these lists may contain zero items, or may not be present at all. |

### ToiletAvailabilityType

| Member | Description |
|--------|-------------|
| `status` | ToiletStatus enumeration (Unknown, InService, NotInService), indicating service status. |
| `value` | Type of toilet (Unknown, None, Standard, Accessible). |

### UncertaintyType

| Member | Description |
|--------|-------------|
| `status` | Uncertainty enumeration (Delay, Cancellation, Other), indicating uncertainty status. |
| `reason` | Uncertainty reason (string), indicating the uncertainty reason with location if any. |
