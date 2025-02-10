import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { FlightSegment, ResumeCardComponent } from "../../components/resume-card/resume-card.component";
import { IPassenger, IPassengerContact, PassengerContactUseCase, PassengerSaveUseCase } from 'passenger';
import { SelectSeatUseCase } from 'seat-availability';
import { GetCostBreakdownUsecase } from '../../../../application/cost/get-cost-brackdown.usecase';
import { combineLatest, last, map, Observable, of, switchMap, takeLast, tap } from 'rxjs';
import { IBookingRequest, Passenger } from '../../../../domain/model/booking.model';
import { GetFlightsSelectedUseCase, GetFlightsUseCase } from 'flight';
import { CreateBookingUsecase } from '../../../../application/booking/create-booking.usecase';

export interface IFlightSummary {
  title: string;
  departureDate: string;
  returnDate: string;
  outboundFlight: FlightSegment;
  returnFlight: FlightSegment;
  flightPrice: number;
  adultTicketPrice: number;
  totalPrice: number;
  disclaimerText: string;
  passengers: number;
}

@Component({
  selector: 'lib-resume-card-container',
  imports: [ResumeCardComponent],
  templateUrl: './resume-card-container.component.html'
})
export class ResumeCardContainerComponent implements OnInit, OnDestroy {

  private readonly _passengerSave = inject(PassengerSaveUseCase);
  private readonly _passengerContact = inject(PassengerContactUseCase);
  readonly _selectedSeatsUsecase = inject(SelectSeatUseCase);
  readonly _getCostBreakdown = inject(GetCostBreakdownUsecase);
  readonly _getFlightSelected = inject(GetFlightsSelectedUseCase);
  readonly _createBookingUseCase = inject(CreateBookingUsecase);

  public contactSave$: Observable<IPassengerContact>;
  public listPassengers$: Observable<IPassenger[]>;
  public selectedSeatsId$: Observable<string[]>;

  flightSumary: IFlightSummary = {
    title: 'Flight summary',
    departureDate: '',
    returnDate: '',
    outboundFlight: {
      origin: '',
      originTime: '',
      destination: '',
      destinationTime: ''
    },
    returnFlight: {
      origin: '',
      originTime: '',
      destination: '',
      destinationTime: ''
    },
    flightPrice: 0,
    adultTicketPrice: 0,
    totalPrice: 0,
    disclaimerText: 'Taxes, surcharges and discounts are included in the final price.',
    passengers: 0
  };

  onContinue() {
    console.log('Continue clicked!');
  }

  ngOnInit(): void {
    this._passengerSave.initSubscriptions();
    this._passengerContact.initSubscriptions();
    this._selectedSeatsUsecase.initSubscriptions();
    this._getCostBreakdown.initSubscriptions();
    this._getFlightSelected.initSubscription();

    this._createBookingUseCase.initSubscriptions();
    this.buildBookingRequest();
  }
  ngOnDestroy(): void {
    this._passengerSave.destroySubscriptions();
    this._passengerContact.destroySubscriptions();
    this._selectedSeatsUsecase.destroySubscriptions();
    this._getCostBreakdown.destroySubscriptions();
    this._getFlightSelected.destroySubscription();
    this._createBookingUseCase.destroySubscriptions();
  }



  buildBookingRequest() {

    const passengers$ = this._passengerSave.getListPassengers$();
    const seatIds$ = this._selectedSeatsUsecase.selectedSeatsId$();
    const costBreakdown$ = this._getCostBreakdown.constBreadown$();
    const contact$ = this._passengerContact.passengerContact$();
    const flights$ = this._getFlightSelected.flight$();


    combineLatest([passengers$, seatIds$, costBreakdown$, contact$, flights$]).pipe(
      switchMap(([passengers, seatIds, costBreakdown,  contact, flight]) => {
        if (
          !passengers || !seatIds || !costBreakdown || !contact ||
          !passengers.length || !seatIds.length || !flight
        ) {
         
          return of(null);
        }
        const passengersWithSeats: Passenger[] = passengers.map((passenger: IPassenger, index: number) => ({
          passengerTitle: passenger?.treatment,
          passengerName: passenger?.name,
          passengerLastName: passenger?.lastName,
          passengerType: 'ADULT',
          seatId: seatIds[index] || null, 
        }));

        console.log(passengersWithSeats.length, "passengers");
        this.flightSumary = {
          title: 'Flight summary',
          departureDate: flight?.origin.departure,
          returnDate: flight?.origin.arrival,
          outboundFlight: {
            origin: flight?.origin.origin,
            originTime: flight?.origin.departure,
            destination: flight?.origin.destination,
            destinationTime: flight?.origin.arrival
          },
          returnFlight: {
            origin: flight?.destination.origin,
            originTime: flight?.destination.departure,
            destination: flight?.destination.destination,
            destinationTime: flight?.destination.arrival
          },
          flightPrice: costBreakdown?.totalAmount,
          adultTicketPrice: costBreakdown?.ticketPrice,
          totalPrice: costBreakdown?.totalAmount,
          disclaimerText: 'Taxes, surcharges and discounts are included in the final price.',
          passengers: passengersWithSeats.length
        };

        console.log("Flight summary", this.flightSumary);
  
        const request: IBookingRequest = {
          bookingStatus: 'CONFIRMED',
          bookingPrice: costBreakdown?.ticketPrice,
          discount: costBreakdown?.discount,
          flightId: 'FLIGHT-ID',
          userId: 'USER-ID',
          paymentMethod: 'TEST-PAY-METHOD',
          email: contact?.email,
          prefix: contact?.prefix,
          phoneNumber: contact?.telephoneNumber,
          departureCity: flight?.origin.origin,
          arrivalCity: flight?.origin.destination,
          departureDate: flight?.origin.departure,
          arrivalDate: flight?.origin.arrival,
          airportTax: costBreakdown?.airportTax,
          additionalCharges: costBreakdown?.additionalCharges,
          fuelInsurance: costBreakdown?.fuelInsurance,
          bookingFee: costBreakdown?.bookingFee,
          totalAmount: costBreakdown?.totalAmount,
          ticketPrice: costBreakdown?.ticketPrice,
          keyNotes: 'Hold you things  pls',
          passengers: passengersWithSeats
        };
  
        return of(request);
      }),
      tap(request => {
        if (request) {
          console.log('Booking Request:', request);

          //this._createBookingUseCase.execute(request);
        }
      })
    ).subscribe();

  }
}
